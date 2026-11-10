import fcntl
import hashlib
import json
import os
import subprocess
from contextlib import contextmanager
from functools import partial
from getpass import getpass
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock

from auth import ACCOUNTS, SESSION_AGE, Sessions, password_record

# Separate ports let both macOS accounts run the journal during fast user switching.
PORT = 20000 + os.getuid() % 40000
ADDRESS = f"localhost:{PORT}"
LOCAL_HOSTS = {ADDRESS, f"127.0.0.1:{PORT}"}
ROUTE = "/api/journal"
DATA = Path(os.environ.get("EDI_QUEST_DATA_DIR") or Path(__file__).resolve().parent / ".journal")
JOURNAL = DATA / "journal.json"
BACKUP = DATA / "journal.previous.json"
CREDENTIALS = DATA / "accounts.json"
write_lock = Lock()
sessions = Sessions()


@contextmanager
def lock_journal():
    with write_lock:
        DATA.mkdir(mode=0o700, parents=True, exist_ok=True)
        directory = os.open(DATA, os.O_RDONLY)
        try:
            fcntl.flock(directory, fcntl.LOCK_EX)
            yield
        finally:
            os.close(directory)


def read_journal():
    try:
        return JOURNAL.read_bytes()
    except FileNotFoundError:
        if BACKUP.exists():
            raise OSError("Brakuje dziennika. Przywróć go z kopii zapasowej.")
        return b"null"


def revision(data):
    return '"' + hashlib.sha256(data).hexdigest() + '"'


def atomic_write(path, data):
    with NamedTemporaryFile(dir=DATA, delete=False) as temporary:
        temp_path = Path(temporary.name)
        try:
            temporary.write(data)
            temporary.flush()
            # The directory limits access to the two macOS accounts.
            os.fchmod(temporary.fileno(), 0o644)
            os.fsync(temporary.fileno())
            temporary.close()
            temp_path.replace(path)
        finally:
            temp_path.unlink(missing_ok=True)


def setup_accounts():
    if CREDENTIALS.exists():
        return
    if not os.isatty(0):
        raise RuntimeError("Uruchom dziennik w Terminalu, żeby ustawić hasła dla Ediego i Mamy.")
    accounts = {}
    print("Pierwsze uruchomienie: ustaw hasła dla kont Edi i Mama.")
    for username, name in ACCOUNTS.items():
        while True:
            password = getpass(f"Hasło dla konta {name} (co najmniej 8 znaków): ")
            if not 8 <= len(password) <= 256:
                print("Hasło musi mieć od 8 do 256 znaków.")
                continue
            if password != getpass("Powtórz hasło: "):
                print("Hasła się różnią. Spróbuj ponownie.")
                continue
            accounts[username] = password_record(password)
            break
    with lock_journal():
        if not CREDENTIALS.exists():
            atomic_write(CREDENTIALS, json.dumps(accounts).encode())


def save_journal(data, expected_revision):
    with lock_journal():
        current = read_journal()
        if expected_revision != revision(current):
            return False
        if data != current:
            atomic_write(BACKUP, data if current == b"null" else current)
            atomic_write(JOURNAL, data)
        return True


class Handler(SimpleHTTPRequestHandler):
    read_journal = staticmethod(read_journal)
    save_journal = staticmethod(save_journal)

    def login(self, username, password):
        return sessions.login(json.loads(CREDENTIALS.read_bytes()), username, password)

    def account(self, token):
        return sessions.account(token)

    def logout(self, token):
        sessions.logout(token)

    def valid_host(self):
        return self.headers.get("Host") in LOCAL_HOSTS

    @property
    def secure_cookie(self):
        return ""

    @property
    def cookie_name(self):
        return f"edi_session_{self.server.server_port}"

    def session_token(self):
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            value = cookie.get(self.cookie_name)
            return value.value if value else ""
        except CookieError:
            return ""

    def send_account(self, status, account=None, token=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        if token is not None:
            age = SESSION_AGE if token else 0
            self.send_header("Set-Cookie", f"{self.cookie_name}={token}; Path=/api; "
                             f"HttpOnly; SameSite=Strict; Max-Age={age}{self.secure_cookie}")
        self.end_headers()
        self.wfile.write(json.dumps({"account": account}).encode())

    def same_origin(self):
        host = self.headers.get("Host")
        return self.valid_host() and self.headers.get("Origin") == f"http://{host}"

    def do_POST(self):
        if self.path not in ("/api/login", "/api/logout"):
            return self.send_error(404)
        if not self.same_origin():
            return self.send_error(403)
        try:
            if self.path == "/api/logout":
                self.logout(self.session_token())
                return self.send_account(200, token="")
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 4096:
                return self.send_account(400)
            fields = json.loads(self.rfile.read(size))
            if not isinstance(fields, dict):
                return self.send_account(400)
            username = fields.get("username")
            password = fields.get("password")
            if not isinstance(username, str) or not isinstance(password, str) or len(password) > 256:
                return self.send_account(400)
            username = username.strip().casefold()
            status, token = self.login(username, password)
            if token:
                self.logout(self.session_token())
        except (ValueError, UnicodeError):
            return self.send_account(400)
        except OSError as error:
            self.log_error("%s", error)
            return self.send_account(503)
        self.send_account(status, ACCOUNTS[username] if token else None, token)

    def send_journal(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("ETag", revision(data))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path not in (ROUTE, "/api/session"):
            return super().do_GET()
        if not self.valid_host():
            return self.send_error(403)
        try:
            account = self.account(self.session_token())
            if self.path == "/api/session":
                return self.send_account(200, account)
            if not account:
                return self.send_account(401)
            data = self.read_journal()
        except OSError as error:
            self.log_error("%s", error)
            return self.send_error(500)
        self.send_journal(data)

    def do_PUT(self):
        if self.path != ROUTE:
            return self.send_error(404)
        if not self.same_origin():
            return self.send_error(403)
        try:
            if not self.account(self.session_token()):
                return self.send_account(401)
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 16 * 1024 * 1024:
                return self.send_error(413)
            data = self.rfile.read(size)
            log = json.loads(data)
            if (not isinstance(log, dict) or
                    not all(isinstance(log.get(key), list)
                            for key in ("quests", "performances", "sessions", "revealed")) or
                    not isinstance(log.get("completed"), dict)):
                return self.send_error(400)
            if not self.save_journal(data, self.headers.get("If-Match")):
                return self.send_error(412)
        except ValueError:
            return self.send_error(400)
        except OSError as error:
            self.log_error("%s", error)
            return self.send_error(500)
        self.send_journal(data)


if __name__ == "__main__":
    handler = partial(Handler, directory="dist")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    except OSError as error:
        print("Nie udało się uruchomić dziennika:", error)
        if os.isatty(0):
            input("Naciśnij Enter, żeby zamknąć okno. ")
        raise SystemExit(1)

    with server:
        try:
            setup_accounts()
        except (RuntimeError, OSError) as error:
            print("Nie udało się przygotować kont:", error)
            raise SystemExit(1)
        except KeyboardInterrupt:
            raise SystemExit(130)
        print(f"Dziennik działa pod adresem http://{ADDRESS}. Zostaw to okno otwarte podczas ćwiczeń.")
        if os.environ.get("EDI_QUEST_NO_OPEN") != "1":
            subprocess.run(["/usr/bin/open", f"http://{ADDRESS}/"], check=False)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
