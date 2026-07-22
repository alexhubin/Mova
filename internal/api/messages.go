package api

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/alexhubin/Mowa/internal/database/dbgen"
	"github.com/go-chi/chi/v5"
)

const maxMessageLength = 2000

type createRoomMessageRequest struct {
	Body string `json:"body"`
}

type messageAuthorResponse struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

type roomMessageResponse struct {
	ID        string                `json:"id"`
	Body      string                `json:"body"`
	Author    messageAuthorResponse `json:"author"`
	CreatedAt time.Time             `json:"created_at"`
}

func (s *Server) listRoomMessages(w http.ResponseWriter, r *http.Request) {
	room, ok := s.findRoom(w, r)
	if !ok {
		return
	}
	if room.Kind == "direct" {
		userID := currentUser(r).ID
		peerID, ok := s.directRoomPeerID(w, r, room.ID, userID)
		if ok {
			s.writeDirectMessages(w, r, userID, peerID)
		}
		return
	}
	rows, err := s.queries.ListRoomMessages(r.Context(), room.ID)
	if err != nil {
		slog.Error("list room messages", "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить сообщения")
		return
	}
	result := make([]roomMessageResponse, len(rows))
	for index, row := range rows {
		result[len(rows)-1-index] = roomMessageResponse{
			ID: row.ID, Body: row.Body, CreatedAt: row.CreatedAt,
			Author: messageAuthorResponse{ID: row.UserID, Username: row.Username, DisplayName: row.DisplayName},
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) createRoomMessage(w http.ResponseWriter, r *http.Request) {
	room, ok := s.findRoom(w, r)
	if !ok {
		return
	}
	body, ok := decodeMessageBody(w, r)
	if !ok {
		return
	}
	user := currentUser(r)
	if room.Kind == "direct" {
		peerID, ok := s.directRoomPeerID(w, r, room.ID, user.ID)
		if ok {
			s.createDirectMessageFor(w, r, user, peerID, body)
		}
		return
	}
	message, err := s.queries.CreateRoomMessage(r.Context(), dbgen.CreateRoomMessageParams{
		ID: s.newID(), RoomID: room.ID, UserID: user.ID, Body: body, CreatedAt: s.now(),
	})
	if err != nil {
		slog.Error("create room message", "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось отправить сообщение")
		return
	}
	s.messageEvents.notify("room:" + room.ID)
	writeJSON(w, http.StatusCreated, roomMessageResponse{
		ID: message.ID, Body: message.Body, CreatedAt: message.CreatedAt,
		Author: messageAuthorResponse{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName},
	})
}

type messageEventBroker struct {
	mu          sync.Mutex
	subscribers map[string]map[chan struct{}]struct{}
}

func newMessageEventBroker() *messageEventBroker {
	return &messageEventBroker{subscribers: make(map[string]map[chan struct{}]struct{})}
}

func (b *messageEventBroker) subscribe(roomID string) (<-chan struct{}, func()) {
	updates := make(chan struct{}, 1)
	b.mu.Lock()
	if b.subscribers[roomID] == nil {
		b.subscribers[roomID] = make(map[chan struct{}]struct{})
	}
	b.subscribers[roomID][updates] = struct{}{}
	b.mu.Unlock()
	return updates, func() {
		b.mu.Lock()
		delete(b.subscribers[roomID], updates)
		if len(b.subscribers[roomID]) == 0 {
			delete(b.subscribers, roomID)
		}
		b.mu.Unlock()
	}
}

func (b *messageEventBroker) notify(roomID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for updates := range b.subscribers[roomID] {
		select {
		case updates <- struct{}{}:
		default:
		}
	}
}

func (s *Server) streamRoomMessageEvents(w http.ResponseWriter, r *http.Request) {
	room, ok := s.findRoom(w, r)
	if !ok {
		return
	}
	if room.Kind == "direct" {
		userID := currentUser(r).ID
		if _, ok := s.directRoomPeerID(w, r, room.ID, userID); ok {
			s.streamMessageEvents(w, r, "user:"+userID)
		}
		return
	}
	s.streamMessageEvents(w, r, "room:"+room.ID)
}

func (s *Server) listDirectMessages(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r).ID
	friendID := chi.URLParam(r, "userID")
	if !s.requireFriend(w, r, userID, friendID) {
		return
	}
	s.writeDirectMessages(w, r, userID, friendID)
}

func (s *Server) writeDirectMessages(w http.ResponseWriter, r *http.Request, userID, friendID string) {
	rows, err := s.queries.ListDirectMessages(r.Context(), dbgen.ListDirectMessagesParams{
		SenderID: userID, RecipientID: friendID,
	})
	if err != nil {
		slog.Error("list direct messages", "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить сообщения")
		return
	}
	result := make([]roomMessageResponse, len(rows))
	for index, row := range rows {
		result[len(rows)-1-index] = roomMessageResponse{
			ID: row.ID, Body: row.Body, CreatedAt: row.CreatedAt,
			Author: messageAuthorResponse{ID: row.SenderID, Username: row.Username, DisplayName: row.DisplayName},
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) createDirectMessage(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	friendID := chi.URLParam(r, "userID")
	if !s.requireFriend(w, r, user.ID, friendID) {
		return
	}
	body, ok := decodeMessageBody(w, r)
	if !ok {
		return
	}
	s.createDirectMessageFor(w, r, user, friendID, body)
}

func (s *Server) createDirectMessageFor(w http.ResponseWriter, r *http.Request, user dbgen.User, friendID, body string) {
	message, err := s.queries.CreateDirectMessage(r.Context(), dbgen.CreateDirectMessageParams{
		ID: s.newID(), SenderID: user.ID, RecipientID: friendID, Body: body, CreatedAt: s.now(),
	})
	if err != nil {
		slog.Error("create direct message", "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось отправить сообщение")
		return
	}
	s.messageEvents.notify("user:" + user.ID)
	s.messageEvents.notify("user:" + friendID)
	writeJSON(w, http.StatusCreated, roomMessageResponse{
		ID: message.ID, Body: message.Body, CreatedAt: message.CreatedAt,
		Author: messageAuthorResponse{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName},
	})
}

func decodeMessageBody(w http.ResponseWriter, r *http.Request) (string, bool) {
	var input createRoomMessageRequest
	if !decodeJSON(w, r, &input) {
		return "", false
	}
	body := strings.TrimSpace(input.Body)
	if length := len([]rune(body)); length == 0 || length > maxMessageLength {
		writeError(w, http.StatusUnprocessableEntity, "Сообщение должно содержать от 1 до 2000 символов")
		return "", false
	}
	return body, true
}

func (s *Server) directRoomPeerID(w http.ResponseWriter, r *http.Request, roomID, userID string) (string, bool) {
	peerID, err := s.queries.GetDirectRoomPeerID(r.Context(), dbgen.GetDirectRoomPeerIDParams{RoomID: roomID, CallerID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Личный звонок не найден")
		return "", false
	}
	if err != nil {
		slog.Error("get direct room peer", "room_id", roomID, "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить личный диалог")
		return "", false
	}
	return peerID, true
}

func (s *Server) streamDirectMessageEvents(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r).ID
	if !s.requireFriend(w, r, userID, chi.URLParam(r, "userID")) {
		return
	}
	s.streamMessageEvents(w, r, "user:"+userID)
}

func (s *Server) requireFriend(w http.ResponseWriter, r *http.Request, userID, friendID string) bool {
	if friendID == "" || friendID == userID {
		writeError(w, http.StatusForbidden, "Личные сообщения доступны только друзьям")
		return false
	}
	isFriend, err := s.queries.IsFriend(r.Context(), dbgen.IsFriendParams{UserID: userID, FriendID: friendID})
	if err != nil {
		slog.Error("check direct message friendship", "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось проверить список друзей")
		return false
	}
	if !isFriend {
		writeError(w, http.StatusForbidden, "Личные сообщения доступны только друзьям")
		return false
	}
	return true
}

func (s *Server) streamMessageEvents(w http.ResponseWriter, r *http.Request, scope string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Поток сообщений недоступен")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("X-Accel-Buffering", "no")

	updates, unsubscribe := s.messageEvents.subscribe(scope)
	defer unsubscribe()
	keepAlive := time.NewTicker(25 * time.Second)
	defer keepAlive.Stop()
	controller := http.NewResponseController(w)
	writeDeadline := func() { _ = controller.SetWriteDeadline(time.Now().Add(35 * time.Second)) }
	writeEvent := func() bool {
		writeDeadline()
		if _, err := fmt.Fprint(w, "event: messages\ndata: {}\n\n"); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}
	if !writeEvent() {
		return
	}

	for {
		select {
		case <-r.Context().Done():
			return
		case <-updates:
			if !writeEvent() {
				return
			}
		case <-keepAlive.C:
			writeDeadline()
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
