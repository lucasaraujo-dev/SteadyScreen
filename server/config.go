package main

import (
	"os"
	"strconv"
	"strings"
)

// Config holds the server settings, read from environment variables.
type Config struct {
	Addr           string   // ADDR, default ":8080"
	MaxViewers     int      // MAX_VIEWERS, default 5 (P2P mesh limit)
	AllowedOrigins []string // ALLOWED_ORIGINS, comma separated; empty = allow any (dev only)
	ICEServers     []ICEServer
}

// ICEServer mirrors the browser's RTCIceServer dictionary.
type ICEServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

func loadConfig() Config {
	cfg := Config{
		Addr:       envOr("ADDR", ":8080"),
		MaxViewers: 5,
	}
	if v, err := strconv.Atoi(os.Getenv("MAX_VIEWERS")); err == nil && v > 0 {
		cfg.MaxViewers = v
	}
	cfg.AllowedOrigins = splitList(os.Getenv("ALLOWED_ORIGINS"))

	stun := splitList(envOr("STUN_URLS", "stun:stun.l.google.com:19302"))
	if len(stun) > 0 {
		cfg.ICEServers = append(cfg.ICEServers, ICEServer{URLs: stun})
	}
	// TURN is optional in phase 1; it becomes required once deployed on the VPS.
	if turn := splitList(os.Getenv("TURN_URLS")); len(turn) > 0 {
		cfg.ICEServers = append(cfg.ICEServers, ICEServer{
			URLs:       turn,
			Username:   os.Getenv("TURN_USERNAME"),
			Credential: os.Getenv("TURN_CREDENTIAL"),
		})
	}
	return cfg
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
