-- Run in the same transaction as provisioning the new accounts.
ALTER TABLE quest_accounts DROP CONSTRAINT quest_accounts_username_check;
ALTER TABLE quest_accounts ADD CONSTRAINT quest_accounts_username_check
    CHECK (username IN ('edi', 'mama', 'tola', 'mateusz'));

CREATE TABLE IF NOT EXISTS quest_personal_journals (
    username text PRIMARY KEY REFERENCES quest_accounts (username),
    current_data bytea NOT NULL,
    previous_data bytea NOT NULL
);
