package main

import (
	"context"
	"crypto/subtle"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ---------- account settings (database side) ----------

var (
	errCodeWrong   = errors.New("wrong code")
	errCodeExpired = errors.New("code expired")
)

const maxCodeAttempts = 5

func (s *Store) updateName(ctx context.Context, id int64, name string) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET name = $2 WHERE id = $1`, id, name)
	return err
}

func (s *Store) passwordHash(ctx context.Context, id int64) (string, error) {
	var hash string
	err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, id).Scan(&hash)
	return hash, err
}

func (s *Store) updatePassword(ctx context.Context, id int64, hash string) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, id, hash)
	return err
}

// updateEmail changes the address; the new one isn't confirmed yet.
func (s *Store) updateEmail(ctx context.Context, id int64, email string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE users SET email = $2, email_verified = (lower(email) = lower($2) AND email_verified)
		  WHERE id = $1`, id, email)
	if isUniqueViolation(err) {
		return errEmailTaken
	}
	if err == nil {
		s.db.Exec(ctx, `DELETE FROM email_codes WHERE user_id = $1`, id)
	}
	return err
}

// saveEmailCode remembers the code sent to `email` (replacing any older one).
func (s *Store) saveEmailCode(ctx context.Context, id int64, email string, codeHash []byte, ttl time.Duration) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO email_codes (user_id, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id) DO UPDATE
		   SET email = EXCLUDED.email, code_hash = EXCLUDED.code_hash,
		       expires_at = EXCLUDED.expires_at, attempts = 0`,
		id, email, codeHash, time.Now().Add(ttl))
	return err
}

// confirmEmail checks a code; when right, the account's email is confirmed.
// Each wrong try counts, and after a few the code stops working.
func (s *Store) confirmEmail(ctx context.Context, id int64, codeHash []byte) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var email string
		var want []byte
		var expires time.Time
		var attempts int
		err := tx.QueryRow(ctx,
			`SELECT email, code_hash, expires_at, attempts FROM email_codes WHERE user_id = $1 FOR UPDATE`,
			id).Scan(&email, &want, &expires, &attempts)
		if errors.Is(err, pgx.ErrNoRows) {
			return errCodeExpired
		}
		if err != nil {
			return err
		}
		if time.Now().After(expires) || attempts >= maxCodeAttempts {
			return errCodeExpired
		}
		if subtle.ConstantTimeCompare(want, codeHash) != 1 {
			_, err := tx.Exec(ctx, `UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = $1`, id)
			if err != nil {
				return err
			}
			return errCodeWrong
		}
		// Only confirms the address the code was sent to.
		tag, err := tx.Exec(ctx,
			`UPDATE users SET email_verified = true WHERE id = $1 AND lower(email) = lower($2)`, id, email)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return errCodeExpired
		}
		_, err = tx.Exec(ctx, `DELETE FROM email_codes WHERE user_id = $1`, id)
		return err
	})
}

func (s *Store) setAvatar(ctx context.Context, id int64, data []byte, contentType string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE users SET avatar = $2, avatar_type = $3, avatar_version = abs(avatar_version) + 1 WHERE id = $1`,
		id, data, contentType)
	return err
}

func (s *Store) clearAvatar(ctx context.Context, id int64) error {
	// The version keeps counting, so an old cached photo never comes back.
	_, err := s.db.Exec(ctx,
		`UPDATE users SET avatar = NULL, avatar_type = '',
		        avatar_version = -abs(avatar_version) - 1 WHERE id = $1`, id)
	return err
}

func (s *Store) avatar(ctx context.Context, id int64) ([]byte, string, error) {
	var data []byte
	var contentType string
	err := s.db.QueryRow(ctx,
		`SELECT avatar, avatar_type FROM users WHERE id = $1 AND avatar IS NOT NULL`, id).
		Scan(&data, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", errNotFound
	}
	return data, contentType, err
}
