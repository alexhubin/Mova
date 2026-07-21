-- +goose Up
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    email VARCHAR(254) NOT NULL,
    display_name VARCHAR(40) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,32}$')
);
CREATE UNIQUE INDEX users_username_lower_uidx ON users (lower(username));
CREATE UNIQUE INDEX users_email_lower_uidx ON users (lower(email));

CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    video_quality VARCHAR(12) NOT NULL DEFAULT 'high',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_settings_video_quality_check CHECK (video_quality IN ('low', 'medium', 'high'))
);

CREATE TABLE sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    invite_code TEXT NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(12) NOT NULL DEFAULT 'group',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rooms_kind_check CHECK (kind IN ('group', 'direct'))
);
CREATE INDEX rooms_owner_id_idx ON rooms(owner_id);

CREATE TABLE room_members (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);
CREATE INDEX room_members_user_id_idx ON room_members(user_id);

CREATE TABLE friend_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT friend_requests_different_users CHECK (sender_id <> receiver_id),
    CONSTRAINT friend_requests_unique_direction UNIQUE (sender_id, receiver_id)
);
CREATE INDEX friend_requests_receiver_id_idx ON friend_requests(receiver_id);

CREATE TABLE friendships (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, friend_id),
    CONSTRAINT friendships_canonical_order CHECK (user_id < friend_id)
);
CREATE INDEX friendships_friend_id_idx ON friendships(friend_id);

CREATE TABLE direct_calls (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
    caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    callee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(12) NOT NULL DEFAULT 'ringing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    CONSTRAINT direct_calls_different_users CHECK (caller_id <> callee_id),
    CONSTRAINT direct_calls_status_check CHECK (status IN ('ringing', 'active', 'declined', 'ended'))
);
CREATE INDEX direct_calls_caller_open_idx ON direct_calls(caller_id, status);
CREATE INDEX direct_calls_callee_open_idx ON direct_calls(callee_id, status);

-- +goose Down
DROP TABLE direct_calls;
DROP TABLE friendships;
DROP TABLE friend_requests;
DROP TABLE room_members;
DROP TABLE rooms;
DROP TABLE sessions;
DROP TABLE user_settings;
DROP TABLE users;
