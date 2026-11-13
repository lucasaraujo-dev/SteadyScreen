package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"math/big"
	"sync"
	"time"
)

const (
	// A room whose host is not connected leaves memory after this long. It
	// stays saved in the database and comes back when someone opens it.
	roomIdleTTL = 10 * time.Minute
	roomIDChars = "abcdefghjkmnpqrstuvwxyz23456789" // no 0/o/1/l/i
	roomIDLen   = 6
)

// Room is one screen-sharing session: one host and up to MaxViewers viewers.
type Room struct {
	ID         string
	HostToken  string
	HostUserID int64 // the account that owns the room
	CreatedAt  time.Time

	host      *Client
	viewers   map[string]*Client
	idleSince time.Time     // when the host was last seen (or the room was created)
	chat      []ChatMessage // recent history, sent to whoever joins
}

// Hub owns every room. All room fields are guarded by mu.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]*Room
	cfg   Config
	store *Store
	auth  *Auth
}

func newHub(cfg Config, store *Store, auth *Auth) *Hub {
	h := &Hub{rooms: make(map[string]*Room), cfg: cfg, store: store, auth: auth}
	go h.janitor()
	return h
}

func newRoom(id string, hostUserID int64, createdAt time.Time) *Room {
	return &Room{
		ID:         id,
		HostToken:  randomHex(16),
		HostUserID: hostUserID,
		CreatedAt:  createdAt,
		viewers:    make(map[string]*Client),
		idleSince:  time.Now(),
	}
}

// createRoom makes a new room owned by userID and saves it.
func (h *Hub) createRoom(ctx context.Context, userID int64) (*Room, error) {
	for range 20 {
		id := randomRoomID()
		ok, err := h.store.insertRoom(ctx, id, userID)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue // id already used by another room
		}
		r := newRoom(id, userID, time.Now())
		h.mu.Lock()
		h.rooms[id] = r
		h.mu.Unlock()
		log.Printf("room %s created", id)
		return r, nil
	}
	return nil, errors.New("no free room id")
}

// getRoom returns a room, loading it (and its recent chat) from the database
// if it isn't in memory. nil means it doesn't exist.
func (h *Hub) getRoom(ctx context.Context, id string) (*Room, error) {
	h.mu.Lock()
	r := h.rooms[id]
	h.mu.Unlock()
	if r != nil {
		return r, nil
	}
	saved, err := h.store.roomByID(ctx, id)
	if errors.Is(err, errNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	chat, err := h.store.recentChat(ctx, id, chatHistory)
	if err != nil {
		return nil, err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[id]; r != nil {
		return r, nil // loaded by someone else meanwhile
	}
	r = newRoom(saved.ID, saved.HostUserID, saved.CreatedAt)
	r.chat = chat
	h.rooms[id] = r
	return r, nil
}

// closeRoom drops a room from memory, telling everyone in it.
func (h *Hub) closeRoom(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.rooms[id]
	if r == nil {
		return
	}
	r.broadcast(Message{Type: "error", Data: mustJSON(map[string]string{"reason": "room-closed"})})
	if r.host != nil {
		r.host.close()
	}
	for _, v := range r.viewers {
		v.close()
	}
	delete(h.rooms, id)
}

// updateUser shows an account's new name or photo in every room it's in.
func (h *Hub) updateUser(u User) {
	h.mu.Lock()
	defer h.mu.Unlock()
	name := cleanName(u.Name, "")
	for _, r := range h.rooms {
		changed := false
		for _, c := range r.members() {
			if c.userID == u.ID && (c.name != name || c.avatar != u.AvatarURL) {
				c.name, c.avatar = name, u.AvatarURL
				changed = true
			}
		}
		if changed {
			h.broadcastParticipants(r)
		}
	}
}

// liveInfo tells whether a room's host is on and how many people watch.
func (h *Hub) liveInfo(id string) (live bool, viewers int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[id]; r != nil {
		return r.host != nil, len(r.viewers)
	}
	return false, 0
}

// RoomInfo is the public view of a room.
type RoomInfo struct {
	ID         string `json:"id"`
	Live       bool   `json:"live"`
	Viewers    int    `json:"viewers"`
	MaxViewers int    `json:"maxViewers"`
}

func (h *Hub) roomInfo(ctx context.Context, id string) (RoomInfo, bool, error) {
	r, err := h.getRoom(ctx, id)
	if err != nil || r == nil {
		return RoomInfo{}, false, err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	return RoomInfo{ID: r.ID, Live: r.host != nil, Viewers: len(r.viewers), MaxViewers: h.cfg.MaxViewers}, true, nil
}

// join attaches a client to a room. It returns an error code for the client
// ("room-not-found", "bad-token", "room-full") or "" on success. Logged-in
// people always show their account name; the room's owner can host it from
// any browser, anyone else needs the room's host token.
func (h *Hub) join(ctx context.Context, c *Client, roomID, token, name string, user *User) string {
	r, err := h.getRoom(ctx, roomID)
	if err != nil {
		log.Printf("loading room %s: %v", roomID, err)
		return "server-error"
	}
	if r == nil {
		return "room-not-found"
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[roomID] != r {
		return "room-closed" // deleted while it was loading
	}
	c.room = r
	if user != nil {
		c.userID = user.ID
		c.avatar = user.AvatarURL
		name = user.Name
	}
	c.name = cleanName(name, c.role)
	c.joinedAt = time.Now()

	if c.role == roleHost {
		owner := user != nil && user.ID == r.HostUserID
		if !owner && (token == "" || token != r.HostToken) {
			return "bad-token"
		}
		go h.store.touchRoom(context.Background(), r.ID)
		if old := r.host; old != nil {
			// Same host reconnecting (e.g. a second tab): the newest one wins.
			old.sendMsg(Message{Type: "error", Data: mustJSON(map[string]string{"reason": "replaced"})})
			old.close()
		}
		r.host = c
		ids := make([]string, 0, len(r.viewers))
		for id := range r.viewers {
			ids = append(ids, id)
		}
		c.sendMsg(Message{Type: "welcome", Data: mustJSON(map[string]any{
			"role": roleHost, "peerId": c.id, "viewers": ids, "maxViewers": h.cfg.MaxViewers,
			"participants": r.participants(), "chat": r.chat, "author": c.author(),
		})})
		for _, v := range r.viewers {
			v.sendMsg(Message{Type: "host-online"})
		}
		h.broadcastParticipants(r)
		log.Printf("room %s: host connected (%d viewers waiting)", r.ID, len(ids))
		return ""
	}

	if len(r.viewers) >= h.cfg.MaxViewers {
		return "room-full"
	}
	r.viewers[c.id] = c
	c.sendMsg(Message{Type: "welcome", Data: mustJSON(map[string]any{
		"role": roleViewer, "peerId": c.id, "hostOnline": r.host != nil, "maxViewers": h.cfg.MaxViewers,
		"participants": r.participants(), "chat": r.chat, "author": c.author(),
	})})
	if r.host != nil {
		r.host.sendMsg(Message{Type: "viewer-joined", Data: mustJSON(map[string]string{"peerId": c.id})})
	}
	h.broadcastParticipants(r)
	log.Printf("room %s: viewer %s joined (%d/%d)", r.ID, c.id, len(r.viewers), h.cfg.MaxViewers)
	return ""
}

func (h *Hub) leave(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := c.room
	if r == nil {
		return
	}
	switch c.role {
	case roleHost:
		if r.host != c {
			return // already replaced by a newer host connection
		}
		r.host = nil
		r.idleSince = time.Now()
		for _, v := range r.viewers {
			v.sendMsg(Message{Type: "host-left"})
		}
		h.broadcastParticipants(r)
		log.Printf("room %s: host disconnected", r.ID)
	case roleViewer:
		if r.viewers[c.id] != c {
			return
		}
		delete(r.viewers, c.id)
		if r.host != nil {
			r.host.sendMsg(Message{Type: "viewer-left", Data: mustJSON(map[string]string{"peerId": c.id})})
		}
		h.broadcastParticipants(r)
		log.Printf("room %s: viewer %s left", r.ID, c.id)
	}
}

// relay forwards a WebRTC signaling message. Hosts address a viewer with
// msg.To; viewers can only talk to the host. The sender is stamped by the
// server so nobody can impersonate another peer.
func (h *Hub) relay(c *Client, msg Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := c.room
	if r == nil {
		return
	}
	out := Message{Type: msg.Type, Data: msg.Data}
	var target *Client
	if c.role == roleHost {
		if r.host != c {
			return
		}
		target = r.viewers[msg.To]
		out.From = roleHost
	} else {
		if r.viewers[c.id] != c {
			return
		}
		target = r.host
		out.From = c.id
	}
	if target != nil {
		target.sendMsg(out)
	}
}

func (h *Hub) janitor() {
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	for range t.C {
		now := time.Now()
		h.mu.Lock()
		for id, r := range h.rooms {
			if r.host == nil && now.Sub(r.idleSince) > roomIdleTTL {
				for _, v := range r.viewers {
					v.sendMsg(Message{Type: "error", Data: mustJSON(map[string]string{"reason": "room-closed"})})
					v.close()
				}
				delete(h.rooms, id)
				log.Printf("room %s expired", id)
			}
		}
		h.mu.Unlock()
	}
}

func randomRoomID() string {
	b := make([]byte, roomIDLen)
	max := big.NewInt(int64(len(roomIDChars)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic(err)
		}
		b[i] = roomIDChars[n.Int64()]
	}
	return string(b)
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func mustJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
