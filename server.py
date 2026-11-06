import fcntl
import hashlib
import json
import os
import subprocess
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock

# Separate ports let both macOS accounts run the journal during fast user switching.
PORT = 20000 + os.getuid() % 40000
ADDRESS = f"localhost:{PORT}"
LOCAL_HOSTS = {ADDRESS, f"127.0.0.1:{PORT}"}
ROUTE = "/api/journal"
DATA = Path(os.environ.get("EDI_QUEST_DATA_DIR") or Path(__file__).resolve().parent / ".journal")
JOURNAL = DATA / "journal.json"
BACKUP = DATA / "journal.previous.json"
write_lock = Lock()


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


class Handler(SimpleHTTPRequestHandler):
    def send_journal(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("ETag", revision(data))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path != ROUTE:
            return super().do_GET()
        if self.headers.get("Host") not in LOCAL_HOSTS:
            return self.send_error(403)
        try:
            data = read_journal()
        except OSError as error:
            self.log_error("%s", error)
            return self.send_error(500)
        self.send_journal(data)

    def do_PUT(self):
        if self.path != ROUTE:
            return self.send_error(404)
        host = self.headers.get("Host")
        if host not in LOCAL_HOSTS or self.headers.get("Origin") != f"http://{host}":
            return self.send_error(403)
        try:
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
        except ValueError:
            return self.send_error(400)

        try:
            with lock_journal():
                current = read_journal()
                if self.headers.get("If-Match") != revision(current):
                    return self.send_error(412)
                if data != current:
                    atomic_write(BACKUP, data if current == b"null" else current)
                    atomic_write(JOURNAL, data)
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
        print(f"Dziennik działa pod adresem http://{ADDRESS}. Zostaw to okno otwarte podczas ćwiczeń.")
        if os.environ.get("EDI_QUEST_NO_OPEN") != "1":
            subprocess.run(["/usr/bin/open", f"http://{ADDRESS}/"], check=False)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
