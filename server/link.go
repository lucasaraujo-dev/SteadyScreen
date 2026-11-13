package main

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Linking a phone with a QR code, without typing the email and password:
//
//  1. The computer (logged in) asks for a code: POST /api/me/link.
//     It shows it as a QR code pointing to /vincular#<code>.
//  2. The phone opens that page and calls POST /api/link/scan. Only the
//     first phone counts; it gets a secret only it knows.
//  3. The computer sees "iPhone · Safari quer entrar" and allows or refuses.
//     This step means a photo of someone's QR code isn't enough to get in.
//  4. The phone calls POST /api/link/finish with its secret until allowed,
//     then gets its own login, listed as a linked phone.
//
// Codes live only in memory and for a short time.

const linkTTL = 3 * time.Minute

type linkState string

const (
	linkWaiting  linkState = "waiting"  // QR on screen, nobody scanned yet
	linkScanned  linkState = "scanned"  // a phone scanned it, the computer must decide
	linkApproved linkState = "approved" // allowed; the phone picks up its login
	linkDone     linkState = "done"     // the phone is logged in
	linkDenied   linkState = "denied"
)

type linkReq struct {
	userID  int64
	expires time.Time
	state   linkState
	device  string
	secret  string // given to the phone that scanned
}

type links struct {
	mu   sync.Mutex
	reqs map[string]*linkReq // by code
}

func newLinks() *links { return &links{reqs: make(map[string]*linkReq)} }

var errLinkGone = errors.New("link code expired")

// get returns the request for a code, forgetting expired ones on the way.
// The caller holds l.mu.
func (l *links) get(code string) (*linkReq, error) {
	now := time.Now()
	for c, r := range l.reqs {
		if now.After(r.expires) {
			delete(l.reqs, c)
		}
	}
	r, ok := l.reqs[code]
	if !ok {
		return nil, errLinkGone
	}
	return r, nil
}

func (a *Auth) linkRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/me/link", a.loggedIn(a.startLink))
	mux.HandleFunc("GET /api/me/link/{code}", a.loggedIn(a.linkStatus))
	mux.HandleFunc("POST /api/me/link/{code}/approve", a.loggedIn(a.answerLink(true)))
	mux.HandleFunc("POST /api/me/link/{code}/deny", a.loggedIn(a.answerLink(false)))
	mux.HandleFunc("POST /api/link/scan", a.scanLink)
	mux.HandleFunc("POST /api/link/finish", a.finishLink)
	mux.HandleFunc("GET /api/me/devices", a.loggedIn(a.listDevices))
	mux.HandleFunc("DELETE /api/me/devices/{id}", a.loggedIn(a.removeDevice))
}

func (a *Auth) startLink(w http.ResponseWriter, r *http.Request, u User) {
	if !a.linkLimiter.allow("link:" + strconv.FormatInt(u.ID, 10)) {
		writeError(w, http.StatusTooManyRequests, "too-many-codes")
		return
	}
	code := randomHex(16)
	a.links.mu.Lock()
	a.links.get("") // sweep old ones
	a.links.reqs[code] = &linkReq{userID: u.ID, expires: time.Now().Add(linkTTL), state: linkWaiting}
	a.links.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"code": code, "expiresIn": int(linkTTL.Seconds())})
}

// linkStatus is what the computer polls while the QR code is on screen.
func (a *Auth) linkStatus(w http.ResponseWriter, r *http.Request, u User) {
	a.links.mu.Lock()
	defer a.links.mu.Unlock()
	req, err := a.links.get(r.PathValue("code"))
	if err != nil || req.userID != u.ID {
		writeJSON(w, http.StatusOK, map[string]any{"state": "expired"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"state": req.state, "device": req.device})
}

func (a *Auth) answerLink(allow bool) func(http.ResponseWriter, *http.Request, User) {
	return func(w http.ResponseWriter, r *http.Request, u User) {
		a.links.mu.Lock()
		defer a.links.mu.Unlock()
		req, err := a.links.get(r.PathValue("code"))
		if err != nil || req.userID != u.ID {
			writeError(w, http.StatusGone, "link-expired")
			return
		}
		if req.state != linkScanned {
			writeError(w, http.StatusConflict, "link-not-scanned")
			return
		}
		if allow {
			req.state = linkApproved
		} else {
			req.state = linkDenied
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// scanLink is called by the phone right after it opens the QR code's link.
func (a *Auth) scanLink(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too-many-attempts")
		return
	}
	var in struct {
		Code string `json:"code"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	a.links.mu.Lock()
	defer a.links.mu.Unlock()
	req, err := a.links.get(in.Code)
	if err != nil {
		writeError(w, http.StatusGone, "link-expired")
		return
	}
	if req.state != linkWaiting {
		// Someone else already scanned this code.
		writeError(w, http.StatusConflict, "link-used")
		return
	}
	req.state = linkScanned
	req.device = deviceName(r.UserAgent())
	req.secret = randomHex(16)
	writeJSON(w, http.StatusOK, map[string]any{"secret": req.secret})
}

// finishLink is polled by the phone until the computer answers.
func (a *Auth) finishLink(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code   string `json:"code"`
		Secret string `json:"secret"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	a.links.mu.Lock()
	req, err := a.links.get(in.Code)
	if err != nil || req.secret == "" ||
		subtle.ConstantTimeCompare([]byte(req.secret), []byte(in.Secret)) != 1 {
		a.links.mu.Unlock()
		writeError(w, http.StatusGone, "link-expired")
		return
	}
	switch req.state {
	case linkDenied:
		delete(a.links.reqs, in.Code)
		a.links.mu.Unlock()
		writeError(w, http.StatusForbidden, "link-denied")
		return
	case linkApproved:
		req.state = linkDone
	default:
		a.links.mu.Unlock()
		writeJSON(w, http.StatusAccepted, map[string]any{"state": req.state})
		return
	}
	userID, device := req.userID, req.device
	a.links.mu.Unlock()

	u, err := a.store.userByID(r.Context(), userID)
	if err != nil {
		serverError(w, "reading account", err)
		return
	}
	token, err := a.store.createDeviceSession(r.Context(), u.ID, sessionTTL, device)
	if err != nil {
		serverError(w, "linking phone", err)
		return
	}
	setSessionCookie(w, r, token)
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
}

func (a *Auth) listDevices(w http.ResponseWriter, r *http.Request, u User) {
	list, err := a.store.devices(r.Context(), u.ID)
	if err != nil {
		serverError(w, "listing phones", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": list})
}

func (a *Auth) removeDevice(w http.ResponseWriter, r *http.Request, u User) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	err = a.store.deleteDevice(r.Context(), u.ID, id)
	if errors.Is(err, errNotFound) {
		writeError(w, http.StatusNotFound, "not-found")
		return
	}
	if err != nil {
		serverError(w, "unlinking phone", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// deviceName turns a User-Agent into something like "iPhone · Safari".
func deviceName(ua string) string {
	has := func(s string) bool { return strings.Contains(ua, s) }
	device := "Celular"
	switch {
	case has("iPhone"):
		device = "iPhone"
	case has("iPad"):
		device = "iPad"
	case has("Android"):
		device = "Android"
	case has("Windows"):
		device = "Windows"
	case has("Macintosh"):
		device = "Mac"
	case has("Linux"):
		device = "Linux"
	}
	browser := ""
	switch {
	case has("SamsungBrowser"):
		browser = "Samsung Internet"
	case has("EdgA") || has("EdgiOS") || has("Edg/"):
		browser = "Edge"
	case has("OPR/") || has("OPiOS"):
		browser = "Opera"
	case has("FxiOS") || has("Firefox"):
		browser = "Firefox"
	case has("CriOS") || has("Chrome"):
		browser = "Chrome"
	case has("Safari"):
		browser = "Safari"
	}
	if browser == "" {
		return device
	}
	return device + " · " + browser
}
