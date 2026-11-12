// Command server is the SteadyScreen signaling API.
//
// Phase 1: it only introduces peers (rooms, invite links and WebRTC
// signaling). Video flows browser-to-browser and never touches the server.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

func main() {
	cfg := loadConfig()
	hub := newHub(cfg)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"iceServers": cfg.ICEServers,
			"maxViewers": cfg.MaxViewers,
		})
	})
	mux.HandleFunc("POST /api/rooms", func(w http.ResponseWriter, r *http.Request) {
		room := hub.createRoom()
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":         room.ID,
			"hostToken":  room.HostToken,
			"maxViewers": cfg.MaxViewers,
		})
	})
	mux.HandleFunc("GET /api/rooms/{id}", func(w http.ResponseWriter, r *http.Request) {
		info, ok := hub.roomInfo(r.PathValue("id"))
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "room-not-found"})
			return
		}
		writeJSON(w, http.StatusOK, info)
	})
	mux.HandleFunc("GET /ws", hub.serveWS)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           cors(cfg, mux),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("SteadyScreen server listening on %s (max %d viewers per room)", cfg.Addr, cfg.MaxViewers)
	log.Fatal(srv.ListenAndServe())
}

func cors(cfg Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !cfg.originAllowed(origin) {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
