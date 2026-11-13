package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store is everything SteadyScreen keeps in Postgres: accounts, login
// sessions, rooms and their chat.
type Store struct {
	db *pgxpool.Pool
}

var (
	errNotFound   = errors.New("not found")
	errEmailTaken = errors.New("email taken")
)

// schema is applied on every start; each statement is safe to run again.
const schema = `
CREATE TABLE IF NOT EXISTS users (
	id            BIGSERIAL PRIMARY KEY,
	name          TEXT NOT NULL,
	email         TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
	token_hash BYTEA PRIMARY KEY,
	user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS rooms (
	id           TEXT PRIMARY KEY,
	host_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_host_idx ON rooms (host_user_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
	id         TEXT PRIMARY KEY,
	room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
	name       TEXT NOT NULL,
	text       TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_room_idx ON chat_messages (room_id, created_at);
`

func openStore(ctx context.Context, url string) (*Store, error) {
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	// The database may still be starting (e.g. right after `docker compose up`).
	var lastErr error
	for i := 0; i < 30; i++ {
		if lastErr = db.Ping(ctx); lastErr == nil {
			break
		}
		time.Sleep(time.Second)
	}
	if lastErr != nil {
		db.Close()
		return nil, fmt.Errorf("database unreachable: %w", lastErr)
	}
	if _, err := db.Exec(ctx, schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("applying schema: %w", err)
	}
	return &Store{db: db}, nil
}

// ---------- accounts ----------

// User is an account as the browser sees it (never the password hash).
type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) createUser(ctx context.Context, name, email, hash string) (User, error) {
	u := User{Name: name, Email: email}
	err := s.db.QueryRow(ctx,
		`INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
		 RETURNING id, created_at`, name, email, hash).Scan(&u.ID, &u.CreatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		return User{}, errEmailTaken
	}
	return u, err
}

// userByEmail returns the account and its password hash.
func (s *Store) userByEmail(ctx context.Context, email string) (User, string, error) {
	var u User
	var hash string
	err := s.db.QueryRow(ctx,
		`SELECT id, name, email, created_at, password_hash FROM users WHERE lower(email) = lower($1)`,
		email).Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", errNotFound
	}
	return u, hash, err
}

// ---------- sessions ----------

// Only a hash of the session token is stored: a leaked database can't be
// used to log in as anyone.
func tokenHash(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

func (s *Store) createSession(ctx context.Context, userID int64, ttl time.Duration) (string, error) {
	token := randomHex(32)
	_, err := s.db.Exec(ctx,
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
		tokenHash(token), userID, time.Now().Add(ttl))
	return token, err
}

func (s *Store) userBySession(ctx context.Context, token string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.name, u.email, u.created_at
		   FROM sessions s JOIN users u ON u.id = s.user_id
		  WHERE s.token_hash = $1 AND s.expires_at > now()`,
		tokenHash(token)).Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, errNotFound
	}
	return u, err
}

func (s *Store) deleteSession(ctx context.Context, token string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash(token))
	return err
}

func (s *Store) deleteExpiredSessions(ctx context.Context) {
	s.db.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= now()`)
}

// ---------- rooms ----------

// SavedRoom is a room as stored: who owns it and when it was last used.
type SavedRoom struct {
	ID         string    `json:"id"`
	HostUserID int64     `json:"-"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
}

// insertRoom saves a new room; false means the id is already taken.
func (s *Store) insertRoom(ctx context.Context, id string, hostUserID int64) (bool, error) {
	tag, err := s.db.Exec(ctx,
		`INSERT INTO rooms (id, host_user_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
		id, hostUserID)
	return tag.RowsAffected() == 1, err
}

func (s *Store) roomByID(ctx context.Context, id string) (SavedRoom, error) {
	var r SavedRoom
	err := s.db.QueryRow(ctx,
		`SELECT id, host_user_id, created_at, last_used_at FROM rooms WHERE id = $1`, id).
		Scan(&r.ID, &r.HostUserID, &r.CreatedAt, &r.LastUsedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return SavedRoom{}, errNotFound
	}
	return r, err
}

func (s *Store) roomsOf(ctx context.Context, userID int64, limit int) ([]SavedRoom, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, host_user_id, created_at, last_used_at FROM rooms
		  WHERE host_user_id = $1 ORDER BY last_used_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (SavedRoom, error) {
		var r SavedRoom
		err := row.Scan(&r.ID, &r.HostUserID, &r.CreatedAt, &r.LastUsedAt)
		return r, err
	})
}

func (s *Store) touchRoom(ctx context.Context, id string) {
	s.db.Exec(ctx, `UPDATE rooms SET last_used_at = now() WHERE id = $1`, id)
}

// deleteRoom removes a room (and its chat) if it belongs to userID.
func (s *Store) deleteRoom(ctx context.Context, id string, userID int64) (bool, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM rooms WHERE id = $1 AND host_user_id = $2`, id, userID)
	return tag.RowsAffected() == 1, err
}

// ---------- chat ----------

func (s *Store) saveChat(ctx context.Context, roomID string, userID int64, m ChatMessage) error {
	var uid *int64
	if userID != 0 {
		uid = &userID
	}
	_, err := s.db.Exec(ctx,
		`INSERT INTO chat_messages (id, room_id, user_id, name, text, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
		m.ID, roomID, uid, m.Name, m.Text, time.UnixMilli(m.At))
	return err
}

// recentChat returns the last `limit` messages of a room, oldest first.
func (s *Store) recentChat(ctx context.Context, roomID string, limit int) ([]ChatMessage, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, name, text, created_at FROM (
		   SELECT id, user_id, name, text, created_at FROM chat_messages
		    WHERE room_id = $1 ORDER BY created_at DESC LIMIT $2
		 ) recent ORDER BY created_at`, roomID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ChatMessage, error) {
		var m ChatMessage
		var at time.Time
		var userID *int64
		err := row.Scan(&m.ID, &userID, &m.Name, &m.Text, &at)
		m.At = at.UnixMilli()
		// Guests' messages can't be tied to anyone after a reload.
		m.Author = "g" + m.ID
		if userID != nil {
			m.Author = "u" + strconv.FormatInt(*userID, 10)
		}
		return m, err
	})
}
