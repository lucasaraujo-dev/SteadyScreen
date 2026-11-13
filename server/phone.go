package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
)

// A linked phone can lend its camera or microphone to a room its account is
// hosting. The phone keeps a WebSocket open (role "phone", no room) and the
// server passes messages between it and the account's host connections:
//
//	host  -> phone: phone-request {kind: "camera"|"mic"}   (server adds room)
//	phone -> host:  phone-reply {kind, accepted: false}    (refused)
//	phone -> host:  phone-offer {kind, sdp}                (accepted: WebRTC)
//	host  -> phone: phone-answer {kind, sdp}
//	both:           phone-ice {kind, candidate}, phone-stop {kind}
//
// Both ends must be the same account, so nobody can reach someone else's
// phone. Hosts get the account's phones as {type: "phones", data: [...]}.

const rolePhone = "phone"

// PhoneInfo is a connected phone as a host sees it.
type PhoneInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// addPhone registers a phone connection for its account. Caller must not
// hold h.mu.
func (h *Hub) addPhone(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.phones[c.userID] == nil {
		h.phones[c.userID] = make(map[string]*Client)
	}
	h.phones[c.userID][c.id] = c
	c.sendMsg(Message{Type: "welcome", Data: mustJSON(map[string]any{
		"role": rolePhone, "peerId": c.id, "name": c.name,
	})})
	h.sendPhonesLocked(c.userID)
	log.Printf("phone %s connected for account %d", c.id, c.userID)
}

func (h *Hub) removePhone(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.phones[c.userID][c.id] != c {
		return
	}
	delete(h.phones[c.userID], c.id)
	if len(h.phones[c.userID]) == 0 {
		delete(h.phones, c.userID)
	}
	// Anything the phone was lending stops.
	for _, host := range h.hostsOfLocked(c.userID) {
		host.sendMsg(Message{Type: "phone-gone", From: c.id})
	}
	h.sendPhonesLocked(c.userID)
}

// phonesOfLocked lists an account's phones. Caller holds h.mu.
func (h *Hub) phonesOfLocked(userID int64) []PhoneInfo {
	list := []PhoneInfo{}
	for _, p := range h.phones[userID] {
		list = append(list, PhoneInfo{ID: p.id, Name: p.name})
	}
	return list
}

// hostsOfLocked returns the account's host connections in every room.
func (h *Hub) hostsOfLocked(userID int64) []*Client {
	var list []*Client
	for _, r := range h.rooms {
		if r.host != nil && r.host.userID == userID {
			list = append(list, r.host)
		}
	}
	return list
}

// sendPhonesLocked tells the account's hosts which phones are available.
func (h *Hub) sendPhonesLocked(userID int64) {
	if userID == 0 {
		return
	}
	msg := Message{Type: "phones", Data: mustJSON(h.phonesOfLocked(userID))}
	for _, host := range h.hostsOfLocked(userID) {
		host.sendMsg(msg)
	}
}

// phoneRelay passes a phone-* message between a host and a phone of the
// same account. The server stamps who sent it.
func (h *Hub) phoneRelay(c *Client, m Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.userID == 0 {
		return
	}
	out := Message{Type: m.Type, From: c.id, Data: m.Data}
	var target *Client
	switch c.role {
	case roleHost:
		if c.room == nil || c.room.host != c {
			return
		}
		switch m.Type {
		case "phone-request":
			var in struct {
				Kind string `json:"kind"`
			}
			if json.Unmarshal(m.Data, &in) != nil || (in.Kind != "camera" && in.Kind != "mic") {
				return
			}
			out.Data = mustJSON(map[string]string{"kind": in.Kind, "room": c.room.ID})
		case "phone-answer", "phone-ice", "phone-stop":
		default:
			return
		}
		target = h.phones[c.userID][m.To]
	case rolePhone:
		if h.phones[c.userID][c.id] != c {
			return
		}
		switch m.Type {
		case "phone-reply", "phone-offer", "phone-ice", "phone-stop":
		default:
			return
		}
		for _, host := range h.hostsOfLocked(c.userID) {
			if host.id == m.To {
				target = host
			}
		}
	}
	if target != nil {
		target.sendMsg(out)
	}
}

// phoneReadPump is the read loop for a phone connection.
func (h *Hub) phoneReadPump(c *Client) {
	defer func() {
		h.removePhone(c)
		c.close()
	}()
	h.readLoop(c, func(m Message) {
		h.phoneRelay(c, m)
	})
}

// phoneName is how the phone is listed: its linked name, or a guess from
// the browser.
func (a *Auth) phoneName(r *http.Request) string {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if name, err := a.store.sessionDevice(context.Background(), c.Value); err == nil && name != "" {
			return name
		}
	}
	return deviceName(r.UserAgent())
}
