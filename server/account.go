package main

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

const (
	codeTTL       = 15 * time.Minute
	maxAvatarSize = 512 * 1024 // the browser sends a small square photo
)

// accountRoutes are the "Configurações da conta" endpoints. All need login.
func (a *Auth) accountRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/me/name", a.loggedIn(a.changeName))
	mux.HandleFunc("POST /api/me/password", a.loggedIn(a.changePassword))
	mux.HandleFunc("POST /api/me/email", a.loggedIn(a.changeEmail))
	mux.HandleFunc("POST /api/me/email/code", a.loggedIn(a.sendEmailCode))
	mux.HandleFunc("POST /api/me/email/confirm", a.loggedIn(a.confirmEmail))
	mux.HandleFunc("POST /api/me/phone", a.loggedIn(a.changePhone))
	mux.HandleFunc("PUT /api/me/avatar", a.loggedIn(a.uploadAvatar))
	mux.HandleFunc("DELETE /api/me/avatar", a.loggedIn(a.removeAvatar))
	mux.HandleFunc("GET /api/avatars/{id}", a.serveAvatar)
}

func (a *Auth) loggedIn(h func(http.ResponseWriter, *http.Request, User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, ok := a.currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "not-logged-in")
			return
		}
		h(w, r, u)
	}
}

// sendUser answers with the account as it is now in the database.
func (a *Auth) sendUser(w http.ResponseWriter, r *http.Request, id int64) {
	u, err := a.store.userByID(r.Context(), id)
	if err != nil {
		serverError(w, "reading account", err)
		return
	}
	if a.onChange != nil {
		a.onChange(u)
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
}

func serverError(w http.ResponseWriter, what string, err error) {
	log.Printf("%s: %v", what, err)
	writeError(w, http.StatusInternalServerError, "server-error")
}

// checkPassword is for changes that need the current password. It counts
// toward the same per-address limit as logging in.
func (a *Auth) checkPassword(w http.ResponseWriter, r *http.Request, u User, password string) bool {
	if !a.limiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too-many-attempts")
		return false
	}
	hash, err := a.store.passwordHash(r.Context(), u.ID)
	if err != nil {
		serverError(w, "reading password", err)
		return false
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		writeError(w, http.StatusUnauthorized, "wrong-password")
		return false
	}
	return true
}

func (a *Auth) changeName(w http.ResponseWriter, r *http.Request, u User) {
	var in struct {
		Name string `json:"name"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		writeError(w, http.StatusBadRequest, "name-required")
		return
	}
	if err := a.store.updateName(r.Context(), u.ID, cleanName(in.Name, "")); err != nil {
		serverError(w, "changing name", err)
		return
	}
	a.sendUser(w, r, u.ID)
}

func (a *Auth) changePassword(w http.ResponseWriter, r *http.Request, u User) {
	var in struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	switch {
	case utf8.RuneCountInString(in.New) < minPassword:
		writeError(w, http.StatusBadRequest, "weak-password")
		return
	case len(in.New) > maxPassword:
		writeError(w, http.StatusBadRequest, "long-password")
		return
	}
	if !a.checkPassword(w, r, u, in.Current) {
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.New), bcryptCost)
	if err != nil {
		serverError(w, "hashing password", err)
		return
	}
	if err := a.store.updatePassword(r.Context(), u.ID, string(hash)); err != nil {
		serverError(w, "changing password", err)
		return
	}
	// Anyone else logged in with the old password is logged out.
	if c, err := r.Cookie(sessionCookie); err == nil {
		a.store.deleteOtherSessions(r.Context(), u.ID, c.Value)
	}
	a.sendUser(w, r, u.ID)
}

func (a *Auth) changeEmail(w http.ResponseWriter, r *http.Request, u User) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	email, ok := cleanEmail(in.Email)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad-email")
		return
	}
	if !a.checkPassword(w, r, u, in.Password) {
		return
	}
	err := a.store.updateEmail(r.Context(), u.ID, email)
	if errors.Is(err, errEmailTaken) {
		writeError(w, http.StatusConflict, "email-taken")
		return
	}
	if err != nil {
		serverError(w, "changing email", err)
		return
	}
	a.sendUser(w, r, u.ID)
}

// sendEmailCode mails a 6-digit code to the account's address.
func (a *Auth) sendEmailCode(w http.ResponseWriter, r *http.Request, u User) {
	if u.EmailVerified {
		writeError(w, http.StatusConflict, "email-already-confirmed")
		return
	}
	if !a.mail.ready() {
		writeError(w, http.StatusServiceUnavailable, "email-not-configured")
		return
	}
	if !a.codeLimiter.allow("code:" + strconv.FormatInt(u.ID, 10)) {
		writeError(w, http.StatusTooManyRequests, "too-many-codes")
		return
	}
	code := randomCode()
	if err := a.store.saveEmailCode(r.Context(), u.ID, u.Email, codeHash(u.ID, code), codeTTL); err != nil {
		serverError(w, "saving email code", err)
		return
	}
	body := fmt.Sprintf("Olá, %s!\r\n\r\nSeu código para confirmar o e-mail no SteadyScreen é:\r\n\r\n    %s\r\n\r\n"+
		"Ele vale por 15 minutos. Se não foi você que pediu, pode ignorar este e-mail.\r\n", u.Name, code)
	if err := a.mail.send(u.Email, "Seu código do SteadyScreen: "+code, body); err != nil {
		log.Printf("sending code to account %d: %v", u.ID, err)
		writeError(w, http.StatusBadGateway, "email-send-failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *Auth) confirmEmail(w http.ResponseWriter, r *http.Request, u User) {
	var in struct {
		Code string `json:"code"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	code := strings.Join(strings.Fields(in.Code), "")
	err := a.store.confirmEmail(r.Context(), u.ID, codeHash(u.ID, code))
	switch {
	case errors.Is(err, errCodeWrong):
		writeError(w, http.StatusBadRequest, "wrong-code")
	case errors.Is(err, errCodeExpired):
		writeError(w, http.StatusGone, "code-expired")
	case err != nil:
		serverError(w, "confirming email", err)
	default:
		a.sendUser(w, r, u.ID)
	}
}

func (a *Auth) changePhone(w http.ResponseWriter, r *http.Request, u User) {
	var in struct {
		Phone string `json:"phone"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	phone, ok := cleanPhone(in.Phone)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad-phone")
		return
	}
	if err := a.store.updatePhone(r.Context(), u.ID, phone); err != nil {
		serverError(w, "changing phone", err)
		return
	}
	a.sendUser(w, r, u.ID)
}

// uploadAvatar takes the photo as the raw request body (JPEG, PNG or WebP).
func (a *Auth) uploadAvatar(w http.ResponseWriter, r *http.Request, u User) {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAvatarSize+1))
	if err != nil || len(data) > maxAvatarSize {
		writeError(w, http.StatusRequestEntityTooLarge, "avatar-too-big")
		return
	}
	// Trust the bytes, not the header the browser sent.
	kind := http.DetectContentType(data)
	if kind != "image/jpeg" && kind != "image/png" && kind != "image/webp" {
		writeError(w, http.StatusUnsupportedMediaType, "bad-image")
		return
	}
	if err := a.store.setAvatar(r.Context(), u.ID, data, kind); err != nil {
		serverError(w, "saving avatar", err)
		return
	}
	a.sendUser(w, r, u.ID)
}

func (a *Auth) removeAvatar(w http.ResponseWriter, r *http.Request, u User) {
	if err := a.store.clearAvatar(r.Context(), u.ID); err != nil {
		serverError(w, "removing avatar", err)
		return
	}
	a.sendUser(w, r, u.ID)
}

func (a *Auth) serveAvatar(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	data, kind, err := a.store.avatar(r.Context(), id)
	if errors.Is(err, errNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		serverError(w, "reading avatar", err)
		return
	}
	h := w.Header()
	h.Set("Content-Type", kind)
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	// The URL carries ?v=<version>, so a new photo gets a new URL.
	h.Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Write(data)
}

// ---------- helpers ----------

func randomCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		panic(err)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// codeHash ties a code to its account, so the stored hash is useless alone.
func codeHash(userID int64, code string) []byte {
	h := sha256.Sum256([]byte(strconv.FormatInt(userID, 10) + ":" + code))
	return h[:]
}

// cleanPhone keeps "+" and digits. Numbers typed without a country code are
// taken as Brazilian. "" removes the phone.
func cleanPhone(s string) (string, bool) {
	var b strings.Builder
	for i, r := range strings.TrimSpace(s) {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '+' && i == 0:
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '(' || r == ')' || r == '.':
		default:
			return "", false
		}
	}
	p := b.String()
	if p == "" {
		return "", true
	}
	if !strings.HasPrefix(p, "+") {
		p = "+55" + strings.TrimLeft(p, "0")
	}
	if n := len(p) - 1; n < 10 || n > 15 {
		return "", false
	}
	return p, true
}
