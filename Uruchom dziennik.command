#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"

if [[ ! -f dist/index.html ]]; then
  printf '%s\n' 'Brakuje zbudowanej aplikacji w folderze dist. Najpierw wykonaj npm ci i npm run build zgodnie z README.'
  read -r -p 'Naciśnij Enter, żeby zamknąć okno. '
  exit 1
fi

if ! command -v python3 >/dev/null; then
  printf '%s\n' 'Do uruchomienia tej wersji potrzebny jest Python 3.'
  read -r -p 'Naciśnij Enter, żeby zamknąć okno. '
  exit 1
fi

exec python3 -u -c '
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import subprocess

handler = partial(SimpleHTTPRequestHandler, directory="dist")
try:
    server = ThreadingHTTPServer(("127.0.0.1", 5173), handler)
except OSError as error:
    print("Nie udało się uruchomić dziennika:", error)
    if os.isatty(0):
        input("Naciśnij Enter, żeby zamknąć okno. ")
    raise SystemExit(1)

with server:
    print("Dziennik działa pod adresem http://localhost:5173. Zostaw to okno otwarte podczas ćwiczeń.")
    if os.environ.get("EDI_QUEST_NO_OPEN") != "1":
        subprocess.run(["/usr/bin/open", "http://localhost:5173/"], check=False)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
'
