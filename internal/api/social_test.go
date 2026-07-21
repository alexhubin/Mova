package api

import (
	"net/http"
	"testing"
)

func TestPersistentAccountsFriendsAndDirectCall(t *testing.T) {
	server, annaClient := newTestServer(t)
	borisClient := newHTTPClient(t)

	response := doJSON(t, annaClient, http.MethodPost, server.URL+"/api/auth/register", map[string]string{
		"email": "anna@example.com", "username": "anna", "password": "very-secure-password", "display_name": "Анна",
	})
	if response.StatusCode != http.StatusCreated {
		t.Fatalf("register Anna status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	response.Body.Close()

	response = doJSON(t, borisClient, http.MethodPost, server.URL+"/api/auth/register", map[string]string{
		"email": "boris@example.com", "username": "boris", "password": "another-secure-password", "display_name": "Борис",
	})
	if response.StatusCode != http.StatusCreated {
		t.Fatalf("register Boris status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var boris userResponse
	decodeResponse(t, response, &boris)

	response = doJSON(t, annaClient, http.MethodPost, server.URL+"/api/friend-requests", map[string]string{"username": "boris"})
	if response.StatusCode != http.StatusCreated {
		t.Fatalf("friend request status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	response.Body.Close()

	response = doJSON(t, borisClient, http.MethodGet, server.URL+"/api/friends", nil)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("list friend requests status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var borisFriends friendsResponse
	decodeResponse(t, response, &borisFriends)
	if len(borisFriends.Incoming) != 1 || borisFriends.Incoming[0].User.Username != "anna" {
		t.Fatalf("unexpected incoming requests: %+v", borisFriends.Incoming)
	}

	response = doJSON(t, borisClient, http.MethodPost, server.URL+"/api/friend-requests/"+borisFriends.Incoming[0].ID+"/accept", nil)
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("accept request status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	response.Body.Close()

	response = doJSON(t, annaClient, http.MethodGet, server.URL+"/api/friends", nil)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("list friends status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var annaFriends friendsResponse
	decodeResponse(t, response, &annaFriends)
	if len(annaFriends.Friends) != 1 || annaFriends.Friends[0].ID != boris.ID {
		t.Fatalf("unexpected friends: %+v", annaFriends.Friends)
	}

	response = doJSON(t, annaClient, http.MethodPost, server.URL+"/api/calls", map[string]string{"user_id": boris.ID})
	if response.StatusCode != http.StatusCreated {
		t.Fatalf("create call status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var call callResponse
	decodeResponse(t, response, &call)
	if call.Status != "ringing" || call.Incoming || call.InviteCode == "" {
		t.Fatalf("unexpected outgoing call: %+v", call)
	}

	response = doJSON(t, borisClient, http.MethodGet, server.URL+"/api/calls", nil)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("list calls status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var calls []callResponse
	decodeResponse(t, response, &calls)
	if len(calls) != 1 || !calls[0].Incoming || calls[0].Peer.Username != "anna" {
		t.Fatalf("unexpected incoming calls: %+v", calls)
	}

	response = doJSON(t, borisClient, http.MethodPost, server.URL+"/api/calls/"+call.ID+"/accept", nil)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("accept call status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	decodeResponse(t, response, &call)
	if call.Status != "active" {
		t.Fatalf("accepted call status = %q", call.Status)
	}

	response = doJSON(t, borisClient, http.MethodPost, server.URL+"/api/rooms/"+call.InviteCode+"/token", nil)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("direct room token status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	response.Body.Close()

	response = doJSON(t, annaClient, http.MethodPut, server.URL+"/api/account/settings", map[string]string{"video_quality": "medium"})
	if response.StatusCode != http.StatusOK {
		t.Fatalf("update settings status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var settings settingsResponse
	decodeResponse(t, response, &settings)
	if settings.VideoQuality != "medium" {
		t.Fatalf("video quality = %q", settings.VideoQuality)
	}

	response = doJSON(t, annaClient, http.MethodPatch, server.URL+"/api/account/profile", map[string]string{"username": "anna_voice", "display_name": "Анна Нова"})
	if response.StatusCode != http.StatusOK {
		t.Fatalf("update profile status = %d, body = %s", response.StatusCode, responseBody(t, response))
	}
	var anna userResponse
	decodeResponse(t, response, &anna)
	if anna.Username != "anna_voice" || anna.DisplayName != "Анна Нова" {
		t.Fatalf("unexpected profile: %+v", anna)
	}
}
