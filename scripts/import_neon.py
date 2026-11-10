"""Copy a local journal into an empty Neon database and verify the result."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth import ACCOUNTS
from cloud_store import connection
from server import BACKUP, CREDENTIALS, DATA, JOURNAL, lock_journal, revision


def validate_journal(data):
    log = json.loads(data)
    if (not isinstance(log, dict)
            or any(not isinstance(log.get(key), list)
                   for key in ("quests", "performances", "sessions", "revealed"))
            or not isinstance(log.get("completed"), dict)):
        raise ValueError("Niepoprawny format dziennika.")
    return log


def snapshot():
    with lock_journal():
        current = JOURNAL.read_bytes()
        log = validate_journal(current)
        previous = BACKUP.read_bytes() if BACKUP.exists() else current
        validate_journal(previous)
        credentials = json.loads(CREDENTIALS.read_bytes())
        if set(credentials) != set(ACCOUNTS):
            raise ValueError("Brakuje konta Edi lub Mama.")
        accounts = []
        for username, record in credentials.items():
            if not (re.fullmatch(r"[a-f0-9]{32}", record["salt"])
                    and re.fullmatch(r"[a-f0-9]{64}", record["hash"])):
                raise ValueError("Niepoprawny zapis hasła.")
            accounts.append((username, record["salt"], record["hash"]))
        backup_dir = DATA / "backups"
        backup_dir.mkdir(mode=0o700, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        copy = backup_dir / f"before-neon-import-{stamp}.json"
        with os.fdopen(os.open(copy, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as output:
            output.write(current)
            output.flush()
            os.fsync(output.fileno())
        if copy.read_bytes() != current:
            raise OSError("Nie udało się zweryfikować lokalnej kopii.")
    return current, previous, sorted(accounts), log, copy


def import_snapshot(current, previous, accounts):
    schema = Path(__file__).with_name("neon_schema.sql").read_text()
    with connection() as db:
        db.execute("SELECT pg_advisory_xact_lock(149052983)")
        db.execute(schema, prepare=False)
        existing = db.execute(
            "SELECT current_data, previous_data FROM quest_journal WHERE id = 1"
        ).fetchone()
        existing_accounts = db.execute(
            "SELECT username, salt, password_digest FROM quest_accounts ORDER BY username"
        ).fetchall()
        if existing is None and not existing_accounts:
            db.execute("INSERT INTO quest_journal VALUES (1, %s, %s)", (current, previous))
            with db.cursor() as cursor:
                cursor.executemany(
                    "INSERT INTO quest_accounts (username, salt, password_digest) VALUES (%s, %s, %s)",
                    accounts,
                )
        saved = db.execute(
            "SELECT current_data, previous_data FROM quest_journal WHERE id = 1"
        ).fetchone()
        saved_accounts = db.execute(
            "SELECT username, salt, password_digest FROM quest_accounts ORDER BY username"
        ).fetchall()
        if saved is None or tuple(map(bytes, saved)) != (current, previous) or saved_accounts != accounts:
            raise ValueError("Zapis w Neon różni się od kopii. Import przerwany bez nadpisywania.")


def main():
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("Ustaw DATABASE_URL w środowisku bez udostępniania go w czacie.")
    current, previous, accounts, log, copy = snapshot()
    print(f"Lokalna kopia: {copy}", flush=True)
    import_snapshot(current, previous, accounts)
    print(f"Neon zweryfikowany: {len(log['quests'])} questów, "
          f"{len(log['performances'])} występów, {len(log['sessions'])} sesji, dwa konta.")
    print(f"Suma kontrolna zapisu: {revision(current)}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(f"Import nie powiódł się: {error}") from None
