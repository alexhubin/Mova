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

-- name: GetOpenCallForUser :one
SELECT * FROM direct_calls
WHERE status IN ('ringing', 'active') AND (caller_id = $1 OR callee_id = $1)
ORDER BY created_at DESC
LIMIT 1;

-- name: RegisterOpenCallParticipant :exec
INSERT INTO open_call_participants (user_id, call_id, created_at)
VALUES ($1, $2, $3);

-- name: ExpireStaleCalls :many
WITH expired AS (
    UPDATE direct_calls
    SET status = 'ended', ended_at = $1
    WHERE (direct_calls.status = 'ringing' AND direct_calls.created_at < $2)
       OR (direct_calls.status = 'active' AND direct_calls.created_at < $3)
    RETURNING direct_calls.id, direct_calls.caller_id, direct_calls.callee_id
), cleared AS (
    DELETE FROM open_call_participants WHERE call_id IN (SELECT id FROM expired)
)
SELECT caller_id, callee_id FROM expired;

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
WITH declined AS (
    UPDATE direct_calls
    SET status = 'declined', ended_at = $3
    WHERE id = $1 AND callee_id = $2 AND status = 'ringing'
    RETURNING *
), cleared AS (
    DELETE FROM open_call_participants WHERE call_id IN (SELECT id FROM declined)
)
SELECT * FROM declined;

-- name: EndDirectCall :one
WITH ended AS (
    UPDATE direct_calls
    SET status = 'ended', ended_at = $3
    WHERE id = $1 AND (caller_id = $2 OR callee_id = $2) AND status IN ('ringing', 'active')
    RETURNING *
), cleared AS (
    DELETE FROM open_call_participants WHERE call_id IN (SELECT id FROM ended)
)
SELECT * FROM ended;
