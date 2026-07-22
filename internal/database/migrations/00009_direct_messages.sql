-- +goose Up
CREATE TABLE direct_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body VARCHAR(2000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT direct_messages_different_users CHECK (sender_id <> recipient_id),
    CONSTRAINT direct_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 2000)
);
CREATE INDEX direct_messages_sender_recipient_created_idx ON direct_messages(sender_id, recipient_id, created_at DESC, id DESC);
CREATE INDEX direct_messages_recipient_sender_created_idx ON direct_messages(recipient_id, sender_id, created_at DESC, id DESC);

-- +goose Down
DROP TABLE direct_messages;
