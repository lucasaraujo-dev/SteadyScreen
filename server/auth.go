package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

const (
	sessionCookie = "ss_session"
	sessionTTL    = 30 * 24 * time.Hour
	bcryptCost    = 12
	minPassword   = 8
	maxPassword   = 72 // bcrypt only looks at the first 72 bytes
	maxEmail      = 254
)

// A real hash of a random password, compared against when the email doesn't
// exist so that "wrong email" and "wrong password" take the same time.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte(randomHex(16)), bcryptCost)

// Auth handles accounts and login sessions.
type Auth struct {
	store       *Store
	limiter     *limiter // password guesses per address
	codeLimiter *limiter // confirmation emails per account
	linkLimiter *limiter // QR codes per account
	links       *links   // QR codes waiting for a phone
	mail        *Mailer
	// onChange runs after someone's name or photo changes (rooms show it live).
	onChange func(User)
}

func newAuth(store *Store, mail *Mailer) *Auth {
	a := &Auth{
		store:       store,
		limiter:     newLimiter(10, time.Minute),
		codeLimiter: newLimiter(3, 10*time.Minute),
		linkLimiter: newLimiter(10, 10*time.Minute),
		links:       newLinks(),
		mail:        mail,
	}
	go func() {
		for range time.Tick(time.Hour) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			store.deleteExpiredSessions(ctx)
			cancel()
		}
	}()
	return a
}

func (a *Auth) routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/signup", a.signup)
	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("POST /api/auth/logout", a.logout)
	mux.HandleFunc("GET /api/me", a.me)
	a.accountRoutes(mux)
	a.linkRoutes(mux)
}

// currentUser returns the logged-in account, if any.
func (a *Auth) currentUser(r *http.Request) (User, bool) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return User{}, false
	}
	u, err := a.store.userBySession(r.Context(), c.Value)
	if err != nil {
		if !errors.Is(err, errNotFound) {
			log.Printf("session lookup: %v", err)
		}
		return User{}, false
	}
	return u, true
}

func (a *Auth) signup(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too-many-attempts")
		return
	}
	var in struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	name := cleanName(in.Name, "")
	email, ok := cleanEmail(in.Email)
	switch {
	case strings.TrimSpace(in.Name) == "":
		writeError(w, http.StatusBadRequest, "name-required")
		return
	case !ok:
		writeError(w, http.StatusBadRequest, "bad-email")
		return
	case utf8.RuneCountInString(in.Password) < minPassword:
		writeError(w, http.StatusBadRequest, "weak-password")
		return
	case len(in.Password) > maxPassword:
		writeError(w, http.StatusBadRequest, "long-password")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcryptCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server-error")
		return
	}
	u, err := a.store.createUser(r.Context(), name, email, string(hash))
	if errors.Is(err, errEmailTaken) {
		writeError(w, http.StatusConflict, "email-taken")
		return
	}
	if err != nil {
		log.Printf("signup: %v", err)
		writeError(w, http.StatusInternalServerError, "server-error")
		return
	}
	log.Printf("account %d created", u.ID)
	a.startSession(w, r, u, http.StatusCreated)
}

func (a *Auth) login(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too-many-attempts")
		return
	}
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	email, _ := cleanEmail(in.Email)
	u, hash, err := a.store.userByEmail(r.Context(), email)
	if err != nil && !errors.Is(err, errNotFound) {
		log.Printf("login: %v", err)
		writeError(w, http.StatusInternalServerError, "server-error")
		return
	}
	if err != nil {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(in.Password))
		writeError(w, http.StatusUnauthorized, "bad-credentials")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "bad-credentials")
		return
	}
	a.startSession(w, r, u, http.StatusOK)
}

func (a *Auth) startSession(w http.ResponseWriter, r *http.Request, u User, status int) {
	token, err := a.store.createSession(r.Context(), u.ID, sessionTTL)
	if err != nil {
		log.Printf("session: %v", err)
		writeError(w, http.StatusInternalServerError, "server-error")
		return
	}
	setSessionCookie(w, r, token)
	writeJSON(w, status, map[string]any{"user": u})
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true, // page scripts can't read it
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode, // other sites can't post with it
	})
}

func (a *Auth) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		a.store.deleteSession(r.Context(), c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: isHTTPS(r), SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (a *Auth) me(w http.ResponseWriter, r *http.Request) {
	u, ok := a.currentUser(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not-logged-in")
		return
	}
	// "device" is set when this browser is a phone linked with the QR code.
	device := ""
	if c, err := r.Cookie(sessionCookie); err == nil {
		device, _ = a.store.sessionDevice(r.Context(), c.Value)
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": u, "device": device})
}

// ---------- helpers ----------

func cleanEmail(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if s == "" || len(s) > maxEmail {
		return s, false
	}
	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s || !strings.Contains(s[strings.LastIndex(s, "@"):], ".") {
		return s, false
	}
	return s, true
}

// readJSON decodes a small JSON body. Requiring JSON also means a plain HTML
// form on another site can't call these endpoints.
func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "json-required")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "bad-request")
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

// clientIP is the visitor's address. Behind nginx the real one is in
// X-Real-IP (nginx overwrites whatever the visitor sent).
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// limiter allows `max` attempts per key in each window (guessing passwords
// gets slow).
type limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string][]time.Time
}

func newLimiter(max int, window time.Duration) *limiter {
	return &limiter{max: max, window: window, hits: make(map[string][]time.Time)}
}

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	recent := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if now.Sub(t) < l.window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.max {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	if len(l.hits) > 10000 { // forget everyone now and then
		l.hits = map[string][]time.Time{key: l.hits[key]}
	}
	return true
}
