-- name: CreateFriendRequest :one
INSERT INTO friend_requests (id, sender_id, receiver_id, created_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetFriendRequestForReceiver :one
SELECT * FROM friend_requests WHERE id = $1 AND receiver_id = $2 LIMIT 1;

-- name: GetFriendRequestBetween :one
SELECT * FROM friend_requests
WHERE (sender_id = $1 AND receiver_id = $2)
   OR (sender_id = $2 AND receiver_id = $1)
LIMIT 1;

-- name: DeleteFriendRequest :exec
DELETE FROM friend_requests WHERE id = $1;

-- name: ListIncomingFriendRequests :many
SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.display_name
FROM friend_requests fr
JOIN users u ON u.id = fr.sender_id
WHERE fr.receiver_id = $1
ORDER BY fr.created_at DESC;

-- name: ListOutgoingFriendRequests :many
SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.display_name
FROM friend_requests fr
JOIN users u ON u.id = fr.receiver_id
WHERE fr.sender_id = $1
ORDER BY fr.created_at DESC;

-- name: CreateFriendship :exec
INSERT INTO friendships (user_id, friend_id, created_at)
VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING;

-- name: IsFriend :one
SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE (user_id = $1 AND friend_id = $2)
       OR (user_id = $2 AND friend_id = $1)
) AS is_friend;

-- name: ListFriends :many
SELECT
    u.id,
    u.username,
    u.display_name,
    f.created_at,
    EXISTS (
        SELECT 1
        FROM sessions s
        WHERE s.user_id = u.id AND s.expires_at > $2 AND s.last_seen_at >= $3
    ) AS online
FROM friendships f
JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
WHERE f.user_id = $1 OR f.friend_id = $1
ORDER BY online DESC, lower(u.display_name), lower(u.username);

-- name: DeleteFriendship :exec
DELETE FROM friendships
WHERE (user_id = $1 AND friend_id = $2)
   OR (user_id = $2 AND friend_id = $1);
