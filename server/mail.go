package main

import (
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// Mailer sends the few emails SteadyScreen needs (the confirmation code)
// through any SMTP service: Gmail, Brevo, Resend, Amazon SES, Zoho…
//
//	SMTP_HOST, SMTP_PORT (587 = STARTTLS, 465 = TLS), SMTP_USER, SMTP_PASS,
//	MAIL_FROM ("SteadyScreen <no-reply@example.com>")
//
// Without SMTP_HOST nothing is sent. MAIL_LOG=1 then writes the code to the
// server log instead, which is handy when testing on your own computer.
type Mailer struct {
	host, port, user, pass, from string
	logOnly                      bool
}

var errMailOff = errors.New("email sending is not set up")

func loadMailer() *Mailer {
	return &Mailer{
		host:    os.Getenv("SMTP_HOST"),
		port:    envOr("SMTP_PORT", "587"),
		user:    os.Getenv("SMTP_USER"),
		pass:    os.Getenv("SMTP_PASS"),
		from:    envOr("MAIL_FROM", os.Getenv("SMTP_USER")),
		logOnly: os.Getenv("MAIL_LOG") == "1",
	}
}

// ready tells whether an email can go out at all.
func (m *Mailer) ready() bool { return m.host != "" || m.logOnly }

func (m *Mailer) send(to, subject, body string) error {
	if m.host == "" {
		if m.logOnly {
			log.Printf("MAIL_LOG to %s: %s\n%s", to, subject, body)
			return nil
		}
		return errMailOff
	}
	fromAddr := m.from
	if i := strings.LastIndex(fromAddr, "<"); i >= 0 {
		fromAddr = strings.Trim(fromAddr[i:], "<> ")
	}
	msg := strings.Join([]string{
		"From: " + m.from,
		"To: " + to,
		"Subject: " + mime.QEncoding.Encode("utf-8", subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		body,
	}, "\r\n")

	addr := net.JoinHostPort(m.host, m.port)
	var c *smtp.Client
	if m.port == "465" { // TLS from the start
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 10 * time.Second}, "tcp", addr, &tls.Config{ServerName: m.host})
		if err != nil {
			return err
		}
		if c, err = smtp.NewClient(conn, m.host); err != nil {
			return err
		}
	} else {
		conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
		if err != nil {
			return err
		}
		if c, err = smtp.NewClient(conn, m.host); err != nil {
			return err
		}
		if err := c.StartTLS(&tls.Config{ServerName: m.host}); err != nil {
			c.Close()
			return fmt.Errorf("starttls: %w", err)
		}
	}
	defer c.Close()
	if m.user != "" {
		if err := c.Auth(smtp.PlainAuth("", m.user, m.pass, m.host)); err != nil {
			return err
		}
	}
	if err := c.Mail(fromAddr); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}
