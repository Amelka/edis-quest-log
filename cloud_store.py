import hashlib
import hmac
import os
import secrets
from contextlib import contextmanager

import psycopg

from auth import ACCOUNTS, SESSION_AGE, password_hash
from server import revision


@contextmanager
def connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise OSError("DATABASE_URL is not configured.")
    try:
        with psycopg.connect(url, connect_timeout=10) as db:
            yield db
    except psycopg.Error as error:
        raise OSError("Neon database operation failed.") from error


def journal_target(account):
    if account in ("Edi", "Mama"):
        return "quest_journal", "id", 1
    if account in ("Tola", "Mateusz"):
        return "quest_personal_journals", "username", account.casefold()
    raise OSError("Unknown journal account.")


def read_journal(account):
    table, column, owner = journal_target(account)
    with connection() as db:
        row = db.execute(
            f"SELECT current_data FROM {table} WHERE {column} = %s", (owner,),
        ).fetchone()
        if row is None:
            raise OSError("Journal has not been initialized.")
        return bytes(row[0])


def save_journal(data, expected_revision, account):
    table, column, owner = journal_target(account)
    with connection() as db:
        row = db.execute(
            f"SELECT current_data FROM {table} WHERE {column} = %s FOR UPDATE", (owner,),
        ).fetchone()
        if row is None:
            raise OSError("Journal has not been initialized.")
        current = bytes(row[0])
        if expected_revision != revision(current):
            return False
        if current != data:
            db.execute(
                f"UPDATE {table} SET current_data = %s, previous_data = %s WHERE {column} = %s",
                (data, current, owner),
            )
        return True


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def login(username, password):
    if username not in ACCOUNTS:
        return 401, None
    with connection() as db:
        record = db.execute(
            """SELECT salt, password_digest, failures, retry_after > now()
               FROM quest_accounts WHERE username = %s FOR UPDATE""", (username,),
        ).fetchone()
        if record is None:
            return 401, None
        salt, digest, failures, within_window = record
        if within_window and failures >= 10:
            return 429, None
        if not hmac.compare_digest(digest, password_hash(password, salt)):
            db.execute(
                """UPDATE quest_accounts SET failures = %s,
                   retry_after = CASE WHEN %s THEN retry_after ELSE now() + interval '1 minute' END
                   WHERE username = %s""",
                (failures + 1 if within_window else 1, within_window, username),
            )
            return 401, None
        db.execute("UPDATE quest_accounts SET failures = 0, retry_after = NULL WHERE username = %s",
                   (username,))
        db.execute("DELETE FROM quest_sessions WHERE expires_at <= now()")
        token = secrets.token_urlsafe(32)
        db.execute(
            """INSERT INTO quest_sessions VALUES (%s, %s, now() + %s * interval '1 second')""",
            (token_digest(token), username, SESSION_AGE),
        )
        return 200, token


def account(token):
    if not token:
        return None
    with connection() as db:
        row = db.execute(
            "SELECT username FROM quest_sessions WHERE token_digest = %s AND expires_at > now()",
            (token_digest(token),),
        ).fetchone()
        return ACCOUNTS[row[0]] if row else None


def logout(token):
    if token:
        with connection() as db:
            db.execute("DELETE FROM quest_sessions WHERE token_digest = %s", (token_digest(token),))
