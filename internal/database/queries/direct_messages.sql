-- name: CreateDirectMessage :one
INSERT INTO direct_messages (id, sender_id, recipient_id, body, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListDirectMessages :many
SELECT
    m.id,
    m.sender_id,
    m.recipient_id,
    m.body,
    m.created_at,
    u.username,
    u.display_name
FROM direct_messages m
JOIN users u ON u.id = m.sender_id
WHERE (m.sender_id = $1 AND m.recipient_id = $2)
   OR (m.sender_id = $2 AND m.recipient_id = $1)
ORDER BY m.created_at DESC, m.id DESC
LIMIT 100;
