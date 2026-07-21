-- name: CreateSession :exec
INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
VALUES ($1, $2, $3, $4, $4);

-- name: GetSessionUser :one
SELECT u.* FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.expires_at > $2
LIMIT 1;

-- name: TouchSession :exec
UPDATE sessions SET last_seen_at = $2 WHERE token_hash = $1;

-- name: IsUserOnline :one
SELECT EXISTS (
    SELECT 1
    FROM sessions
    WHERE user_id = $1 AND expires_at > $2 AND last_seen_at >= $3
) AS online;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at <= $1;
