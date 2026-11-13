package main

import (
	"context"
	"encoding/json"
	"log"
	"sort"
	"strings"
	"time"
	"unicode"
)

const (
	maxNameRunes = 32
	maxChatRunes = 500
	chatHistory  = 100
)

// Participant is how a member of the room is shown to everyone.
type Participant struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	Sharing string `json:"sharing,omitempty"`
}

// ChatMessage is one line in the room chat. The server stamps the author.
type ChatMessage struct {
	ID   string `json:"id"`
	From string `json:"from"`
	Name string `json:"name"`
	Text string `json:"text"`
	At   int64  `json:"at"` // unix milliseconds
}

// participants lists the host first, then viewers in the order they joined.
// Caller holds Hub.mu.
func (r *Room) participants() []Participant {
	list := make([]Participant, 0, len(r.viewers)+1)
	if r.host != nil {
		list = append(list, Participant{ID: r.host.id, Name: r.host.name, Role: roleHost, Sharing: r.host.sharing})
	}
	viewers := make([]*Client, 0, len(r.viewers))
	for _, v := range r.viewers {
		viewers = append(viewers, v)
	}
	sort.Slice(viewers, func(i, j int) bool { return viewers[i].joinedAt.Before(viewers[j].joinedAt) })
	for _, v := range viewers {
		list = append(list, Participant{ID: v.id, Name: v.name, Role: roleViewer})
	}
	return list
}

// broadcast sends a message to everyone in the room. Caller holds Hub.mu.
func (r *Room) broadcast(m Message) {
	if r.host != nil {
		r.host.sendMsg(m)
	}
	for _, v := range r.viewers {
		v.sendMsg(m)
	}
}

// broadcastParticipants tells everyone who is in the room. Caller holds Hub.mu.
func (h *Hub) broadcastParticipants(r *Room) {
	r.broadcast(Message{Type: "participants", Data: mustJSON(r.participants())})
}

// isMember reports whether c is still the live connection for its seat.
// Caller holds Hub.mu.
func (r *Room) isMember(c *Client) bool {
	if c.role == roleHost {
		return r.host == c
	}
	return r.viewers[c.id] == c
}

func (h *Hub) chatMessage(c *Client, data json.RawMessage) {
	var in struct {
		Text string `json:"text"`
	}
	if json.Unmarshal(data, &in) != nil {
		return
	}
	text := truncateRunes(strings.TrimSpace(in.Text), maxChatRunes)
	if text == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	r := c.room
	if r == nil || !r.isMember(c) {
		return
	}
	msg := ChatMessage{ID: randomHex(8), From: c.id, Name: c.name, Text: text, At: time.Now().UnixMilli()}
	r.chat = append(r.chat, msg)
	if len(r.chat) > chatHistory {
		r.chat = r.chat[len(r.chat)-chatHistory:]
	}
	r.broadcast(Message{Type: "chat", Data: mustJSON(msg)})

	// Saved in the background so the chat never waits on the database.
	roomID, userID := r.ID, c.userID
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := h.store.saveChat(ctx, roomID, userID, msg); err != nil {
			log.Printf("saving chat in room %s: %v", roomID, err)
		}
	}()
}

func (h *Hub) rename(c *Client, data json.RawMessage) {
	var in struct {
		Name string `json:"name"`
	}
	if json.Unmarshal(data, &in) != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	r := c.room
	if r == nil || !r.isMember(c) || c.userID != 0 {
		return // logged-in people always show their account name
	}
	c.name = cleanName(in.Name, c.role)
	h.broadcastParticipants(r)
}

func (h *Hub) setSharing(c *Client, data json.RawMessage) {
	var in struct {
		Sharing string `json:"sharing"`
	}
	if json.Unmarshal(data, &in) != nil {
		return
	}
	if in.Sharing != "screen" && in.Sharing != "camera" {
		in.Sharing = ""
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	r := c.room
	if r == nil || !r.isMember(c) {
		return
	}
	c.sharing = in.Sharing
	h.broadcastParticipants(r)
}

// cleanName trims and limits a display name, dropping control characters.
func cleanName(name, role string) string {
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name)
	name = truncateRunes(strings.Join(strings.Fields(name), " "), maxNameRunes)
	if name == "" {
		if role == roleHost {
			return "Anfitrião"
		}
		return "Convidado"
	}
	return name
}

func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}
