CREATE TABLE IF NOT EXISTS quest_journal (
    id smallint PRIMARY KEY CHECK (id = 1),
    current_data bytea NOT NULL,
    previous_data bytea NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_accounts (
    username text PRIMARY KEY CHECK (username IN ('edi', 'mama')),
    salt text NOT NULL,
    password_digest text NOT NULL,
    failures integer NOT NULL DEFAULT 0,
    retry_after timestamptz
);

CREATE TABLE IF NOT EXISTS quest_sessions (
    token_digest text PRIMARY KEY,
    username text NOT NULL REFERENCES quest_accounts (username),
    expires_at timestamptz NOT NULL
);
