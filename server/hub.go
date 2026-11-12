package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"math/big"
	"sync"
	"time"
)

const (
	// A room whose host is not connected is deleted after this long.
	roomIdleTTL = 10 * time.Minute
	roomIDChars = "abcdefghjkmnpqrstuvwxyz23456789" // no 0/o/1/l/i
	roomIDLen   = 6
)

// Room is one screen-sharing session: one host and up to MaxViewers viewers.
type Room struct {
	ID        string
	HostToken string
	CreatedAt time.Time

	host      *Client
	viewers   map[string]*Client
	idleSince time.Time // when the host was last seen (or the room was created)
	chat      []ChatMessage // recent history, sent to whoever joins
}

// Hub owns every room. All room fields are guarded by mu.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]*Room
	cfg   Config
}

func newHub(cfg Config) *Hub {
	h := &Hub{rooms: make(map[string]*Room), cfg: cfg}
	go h.janitor()
	return h
}

func (h *Hub) createRoom() *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	id := randomRoomID()
	for h.rooms[id] != nil {
		id = randomRoomID()
	}
	now := time.Now()
	r := &Room{
		ID:        id,
		HostToken: randomHex(16),
		CreatedAt: now,
		viewers:   make(map[string]*Client),
		idleSince: now,
	}
	h.rooms[id] = r
	log.Printf("room %s created", id)
	return r
}

// RoomInfo is the public view of a room.
type RoomInfo struct {
	ID         string `json:"id"`
	Live       bool   `json:"live"`
	Viewers    int    `json:"viewers"`
	MaxViewers int    `json:"maxViewers"`
}

func (h *Hub) roomInfo(id string) (RoomInfo, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.rooms[id]
	if r == nil {
		return RoomInfo{}, false
	}
	return RoomInfo{ID: r.ID, Live: r.host != nil, Viewers: len(r.viewers), MaxViewers: h.cfg.MaxViewers}, true
}

// join attaches a client to a room. It returns an error code for the client
// ("room-not-found", "bad-token", "room-full") or "" on success.
func (h *Hub) join(c *Client, roomID, token, name string) string {
	h.mu.Lock()
	defer h.mu.Unlock()

	r := h.rooms[roomID]
	if r == nil {
		return "room-not-found"
	}
	c.room = r
	c.name = cleanName(name, c.role)
	c.joinedAt = time.Now()

	if c.role == roleHost {
		if token != r.HostToken {
			return "bad-token"
		}
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
			"participants": r.participants(), "chat": r.chat,
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
		"participants": r.participants(), "chat": r.chat,
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
