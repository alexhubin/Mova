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
