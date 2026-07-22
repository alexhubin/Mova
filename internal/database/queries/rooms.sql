-- name: CreateRoom :one
INSERT INTO rooms (id, invite_code, name, owner_id, kind, created_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: AddRoomMember :exec
INSERT INTO room_members (room_id, user_id, created_at)
VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING;

-- name: IsRoomMember :one
SELECT EXISTS (
    SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2
) AS is_member;

-- name: GetRoomByInviteCode :one
SELECT * FROM rooms WHERE invite_code = $1 LIMIT 1;

-- name: GetDirectRoomPeerID :one
SELECT CASE WHEN caller_id = $2 THEN callee_id ELSE caller_id END AS peer_id
FROM direct_calls
WHERE room_id = $1 AND (caller_id = $2 OR callee_id = $2)
LIMIT 1;

-- name: MarkRoomStarted :exec
UPDATE rooms SET livekit_room_sid = $2 WHERE id = $1;

-- name: DeleteRoomByFinishedSession :execrows
DELETE FROM rooms
WHERE id = $1 AND (livekit_room_sid IS NULL OR livekit_room_sid = $2);
