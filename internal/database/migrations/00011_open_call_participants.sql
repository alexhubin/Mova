-- +goose Up
UPDATE direct_calls
SET status = 'ended', ended_at = now()
WHERE status IN ('ringing', 'active');

CREATE TABLE open_call_participants (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    call_id TEXT NOT NULL REFERENCES direct_calls(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX open_call_participants_call_id_idx ON open_call_participants(call_id);

-- +goose Down
DROP TABLE open_call_participants;
