import hashlib
import hmac
import secrets
import time
from threading import Lock

ACCOUNTS = {"edi": "Edi", "mama": "Mama"}
SESSION_AGE = 12 * 60 * 60


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600_000).hex()


def password_record(password):
    salt = secrets.token_hex(16)
    return {"salt": salt, "hash": password_hash(password, salt)}


class Sessions:
    def __init__(self):
        self.lock = Lock()
        self.active = {}
        self.attempts = []

    def login(self, accounts, username, password):
        now = time.monotonic()
        with self.lock:
            self.attempts = [attempt for attempt in self.attempts if now - attempt < 60]
            if len(self.attempts) >= 10:
                return 429, None
            self.attempts.append(now)
            record = accounts.get(username)
            if not record or not hmac.compare_digest(
                record["hash"], password_hash(password, record["salt"])
            ):
                return 401, None
            self.attempts.remove(now)
            self.active = {key: session for key, session in self.active.items() if session[1] > now}
            token = secrets.token_urlsafe(32)
            self.active[token] = (username, now + SESSION_AGE)
            return 200, token

    def account(self, token):
        with self.lock:
            username, expires = self.active.get(token, (None, 0))
            if expires > time.monotonic():
                return ACCOUNTS[username]
            self.active.pop(token, None)
            return None

    def logout(self, token):
        with self.lock:
            self.active.pop(token, None)
