package api

import "net/http"

func (s *Server) streamCallEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, s.callEvents, currentUser(r).ID, "calls")
}
