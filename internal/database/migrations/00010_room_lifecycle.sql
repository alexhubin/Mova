-- +goose Up
ALTER TABLE rooms ADD COLUMN livekit_room_sid TEXT;

INSERT INTO direct_messages (id, sender_id, recipient_id, body, created_at)
SELECT
    m.id,
    m.user_id,
    CASE WHEN c.caller_id = m.user_id THEN c.callee_id ELSE c.caller_id END,
    m.body,
    m.created_at
FROM room_messages m
JOIN rooms r ON r.id = m.room_id AND r.kind = 'direct'
JOIN direct_calls c ON c.room_id = r.id
ON CONFLICT (id) DO NOTHING;

-- +goose Down
ALTER TABLE rooms DROP COLUMN livekit_room_sid;
