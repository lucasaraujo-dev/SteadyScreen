// Command server is the SteadyScreen signaling API.
//
// It introduces peers (rooms, invite links and WebRTC signaling) and keeps
// accounts, rooms and chat in Postgres. Video flows browser-to-browser and
// never touches the server.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

func main() {
	cfg := loadConfig()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is not set (e.g. postgres://user:pass@localhost:5432/steadyscreen)")
	}
	store, err := openStore(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	auth := newAuth(store)
	hub := newHub(cfg, store, auth)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"iceServers": cfg.iceServers(),
			"maxViewers": cfg.MaxViewers,
		})
	})
	auth.routes(mux)

	// Only people with an account create rooms; anyone with the link watches.
	mux.HandleFunc("POST /api/rooms", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "not-logged-in")
			return
		}
		room, err := hub.createRoom(r.Context(), user.ID)
		if err != nil {
			log.Printf("create room: %v", err)
			writeError(w, http.StatusInternalServerError, "server-error")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":         room.ID,
			"hostToken":  room.HostToken,
			"maxViewers": cfg.MaxViewers,
		})
	})
	mux.HandleFunc("GET /api/rooms/{id}", func(w http.ResponseWriter, r *http.Request) {
		info, ok, err := hub.roomInfo(r.Context(), r.PathValue("id"))
		if err != nil {
			log.Printf("room info: %v", err)
			writeError(w, http.StatusInternalServerError, "server-error")
			return
		}
		if !ok {
			writeError(w, http.StatusNotFound, "room-not-found")
			return
		}
		writeJSON(w, http.StatusOK, info)
	})
	mux.HandleFunc("DELETE /api/rooms/{id}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "not-logged-in")
			return
		}
		id := r.PathValue("id")
		deleted, err := store.deleteRoom(r.Context(), id, user.ID)
		if err != nil {
			log.Printf("delete room: %v", err)
			writeError(w, http.StatusInternalServerError, "server-error")
			return
		}
		if !deleted {
			writeError(w, http.StatusNotFound, "room-not-found")
			return
		}
		hub.closeRoom(id)
		w.WriteHeader(http.StatusNoContent)
	})
	// The logged-in person's rooms, newest use first.
	mux.HandleFunc("GET /api/me/rooms", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "not-logged-in")
			return
		}
		saved, err := store.roomsOf(r.Context(), user.ID, 20)
		if err != nil {
			log.Printf("list rooms: %v", err)
			writeError(w, http.StatusInternalServerError, "server-error")
			return
		}
		type item struct {
			SavedRoom
			Live    bool `json:"live"`
			Viewers int  `json:"viewers"`
		}
		list := make([]item, 0, len(saved))
		for _, s := range saved {
			live, viewers := hub.liveInfo(s.ID)
			list = append(list, item{s, live, viewers})
		}
		writeJSON(w, http.StatusOK, map[string]any{"rooms": list})
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
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
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
