-- name: CreateDirectCall :one
INSERT INTO direct_calls (id, room_id, caller_id, callee_id, status, created_at)
VALUES ($1, $2, $3, $4, 'ringing', $5)
RETURNING *;

-- name: GetOpenCallBetween :one
SELECT * FROM direct_calls
WHERE status IN ('ringing', 'active')
  AND ((caller_id = $1 AND callee_id = $2) OR (caller_id = $2 AND callee_id = $1))
ORDER BY created_at DESC
LIMIT 1;

-- name: GetCallForParticipant :one
SELECT * FROM direct_calls
WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
LIMIT 1;

-- name: ListOpenCallsForUser :many
SELECT
    c.id,
    c.room_id,
    c.caller_id,
    c.callee_id,
    c.status,
    c.created_at,
    c.answered_at,
    c.ended_at,
    r.invite_code,
    u.id AS peer_id,
    u.username AS peer_username,
    u.display_name AS peer_display_name,
    (c.callee_id = $1) AS incoming
FROM direct_calls c
JOIN rooms r ON r.id = c.room_id
JOIN users u ON u.id = CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END
WHERE (c.caller_id = $1 OR c.callee_id = $1)
  AND c.status IN ('ringing', 'active')
ORDER BY c.created_at DESC;

-- name: AcceptDirectCall :one
UPDATE direct_calls
SET status = 'active', answered_at = $3
WHERE id = $1 AND callee_id = $2 AND status = 'ringing'
RETURNING *;

-- name: DeclineDirectCall :one
UPDATE direct_calls
SET status = 'declined', ended_at = $3
WHERE id = $1 AND callee_id = $2 AND status = 'ringing'
RETURNING *;

-- name: EndDirectCall :one
UPDATE direct_calls
SET status = 'ended', ended_at = $3
WHERE id = $1 AND (caller_id = $2 OR callee_id = $2) AND status IN ('ringing', 'active')
RETURNING *;
