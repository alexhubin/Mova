-- +goose Up
ALTER TABLE sessions
ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- +goose Down
ALTER TABLE sessions
DROP COLUMN last_seen_at;
