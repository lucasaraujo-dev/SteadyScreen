package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds the server settings, read from environment variables.
type Config struct {
	Addr           string      // ADDR, default ":8080"
	MaxViewers     int         // MAX_VIEWERS, default 5 (P2P mesh limit)
	AllowedOrigins []string    // ALLOWED_ORIGINS, comma separated; empty = allow any (dev only)
	ICEServers     []ICEServer // STUN, plus TURN with fixed credentials
	DatabaseURL    string      // DATABASE_URL, Postgres connection string (required)

	// TURN relay with short-lived credentials (coturn's use-auth-secret).
	TurnURLs   []string // TURN_URLS
	TurnSecret string   // TURN_SECRET, shared with coturn's static-auth-secret
}

// ICEServer mirrors the browser's RTCIceServer dictionary.
type ICEServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

func loadConfig() Config {
	cfg := Config{
		Addr:        envOr("ADDR", ":8080"),
		MaxViewers:  5,
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if v, err := strconv.Atoi(os.Getenv("MAX_VIEWERS")); err == nil && v > 0 {
		cfg.MaxViewers = v
	}
	cfg.AllowedOrigins = splitList(os.Getenv("ALLOWED_ORIGINS"))

	stun := splitList(envOr("STUN_URLS", "stun:stun.l.google.com:19302"))
	if len(stun) > 0 {
		cfg.ICEServers = append(cfg.ICEServers, ICEServer{URLs: stun})
	}
	// TURN relays the video when two browsers can't reach each other directly
	// (most home routers and mobile networks). With TURN_SECRET each visitor
	// gets credentials that expire; otherwise TURN_USERNAME/TURN_CREDENTIAL.
	cfg.TurnURLs = splitList(os.Getenv("TURN_URLS"))
	cfg.TurnSecret = os.Getenv("TURN_SECRET")
	if len(cfg.TurnURLs) > 0 && cfg.TurnSecret == "" {
		cfg.ICEServers = append(cfg.ICEServers, ICEServer{
			URLs:       cfg.TurnURLs,
			Username:   os.Getenv("TURN_USERNAME"),
			Credential: os.Getenv("TURN_CREDENTIAL"),
		})
	}
	return cfg
}

// iceServers is what a browser gets from /api/config: STUN and, with a
// TURN secret, fresh TURN credentials valid for a day (TURN REST API:
// username = expiry time, password = HMAC-SHA1 of it with the secret).
func (c Config) iceServers() []ICEServer {
	list := append([]ICEServer(nil), c.ICEServers...)
	if len(c.TurnURLs) > 0 && c.TurnSecret != "" {
		user := strconv.FormatInt(time.Now().Add(24*time.Hour).Unix(), 10) + ":steadyscreen"
		mac := hmac.New(sha1.New, []byte(c.TurnSecret))
		mac.Write([]byte(user))
		list = append(list, ICEServer{
			URLs:       c.TurnURLs,
			Username:   user,
			Credential: base64.StdEncoding.EncodeToString(mac.Sum(nil)),
		})
	}
	return list
}

func (c Config) originAllowed(origin string) bool {
	if len(c.AllowedOrigins) == 0 || origin == "" {
		return true
	}
	for _, o := range c.AllowedOrigins {
		if o == "*" || strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
