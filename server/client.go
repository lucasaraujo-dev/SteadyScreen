package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	roleHost   = "host"
	roleViewer = "viewer"

	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 25 * time.Second
	maxMessageSize = 64 * 1024 // SDP offers fit comfortably
	sendBuffer     = 64
)

// Message is the signaling envelope exchanged over the WebSocket.
//
//	client -> server: {type: "offer"|"answer"|"ice", to?: peerId, data: {...}}
//	server -> client: {type, from?, data?}
type Message struct {
	Type string          `json:"type"`
	To   string          `json:"to,omitempty"`
	From string          `json:"from,omitempty"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Client is one WebSocket connection (a host or a viewer).
type Client struct {
	id   string
	role string
	room *Room // set by Hub.join, guarded by Hub.mu

	userID int64  // logged-in account, 0 for guests
	avatar string // that account's photo URL, "" without one

	// Guarded by Hub.mu.
	name     string
	sharing  string // "", "screen" or "camera" (host only)
	joinedAt time.Time

	conn      *websocket.Conn
	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once
}

// sendMsg queues a message without blocking. A client that cannot keep up
// is disconnected rather than stalling the hub.
func (c *Client) sendMsg(m Message) {
	b, err := json.Marshal(m)
	if err != nil {
		return
	}
	select {
	case <-c.done:
	case c.send <- b:
	default:
		log.Printf("client %s too slow, dropping", c.id)
		c.close()
	}
}

// author is how this person's chat messages are tagged (see ChatMessage).
func (c *Client) author() string {
	if c.userID != 0 {
		return "u" + strconv.FormatInt(c.userID, 10)
	}
	return "p" + c.id
}

func (c *Client) close() {
	c.closeOnce.Do(func() { close(c.done) })
}

func (c *Client) writePump() {
	ping := time.NewTicker(pingPeriod)
	defer func() {
		ping.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case b := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, b); err != nil {
				return
			}
		case <-ping.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-c.done:
			// Flush whatever is queued (e.g. a final error message), then close.
			for {
				select {
				case b := <-c.send:
					c.conn.SetWriteDeadline(time.Now().Add(writeWait))
					c.conn.WriteMessage(websocket.TextMessage, b)
				default:
					c.conn.SetWriteDeadline(time.Now().Add(writeWait))
					c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
					return
				}
			}
		}
	}
}

func (h *Hub) readPump(c *Client) {
	defer func() {
		h.leave(c)
		c.close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var m Message
		if err := json.Unmarshal(data, &m); err != nil {
			continue
		}
		switch m.Type {
		case "ice":
			h.relay(c, m)
		case "offer", "bye": // bye = host stopped sharing with that viewer
			if c.role == roleHost {
				h.relay(c, m)
			}
		case "answer":
			if c.role == roleViewer {
				h.relay(c, m)
			}
		case "chat":
			h.chatMessage(c, m.Data)
		case "rename":
			h.rename(c, m.Data)
		case "state": // host tells the room what it is sharing
			if c.role == roleHost {
				h.setSharing(c, m.Data)
			}
		}
	}
}

// serveWS handles GET /ws?room=ID&role=host|viewer[&token=HOST_TOKEN].
func (h *Hub) serveWS(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin:     func(r *http.Request) bool { return h.cfg.originAllowed(r.Header.Get("Origin")) },
	}
	q := r.URL.Query()
	role := q.Get("role")
	if role != roleHost && role != roleViewer {
		http.Error(w, "invalid role", http.StatusBadRequest)
		return
	}
	var user *User
	if u, ok := h.auth.currentUser(r); ok {
		user = &u
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return // Upgrade already wrote the HTTP error
	}
	c := &Client{
		id:   randomHex(6),
		role: role,
		conn: conn,
		send: make(chan []byte, sendBuffer),
		done: make(chan struct{}),
	}
	go c.writePump()

	if code := h.join(r.Context(), c, q.Get("room"), q.Get("token"), q.Get("name"), user); code != "" {
		c.sendMsg(Message{Type: "error", Data: mustJSON(map[string]string{"reason": code})})
		c.close()
		return
	}
	h.readPump(c)
}
