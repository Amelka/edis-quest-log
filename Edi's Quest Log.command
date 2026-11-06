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

exec python3 -u server.py
