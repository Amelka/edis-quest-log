"""Add Tola and Mateusz atomically, without changing existing journal data.

Requires DATABASE_URL. Passwords are prompted without echo and never saved.
"""
import hmac
import sys
from getpass import getpass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth import password_hash, password_record
from cloud_store import connection

NEW_ACCOUNTS = {"tola": "Tola", "mateusz": "Mateusz"}


def provision_accounts(passwords):
    if set(passwords) != set(NEW_ACCOUNTS):
        raise ValueError("Podaj hasła dla Toli i Mateusza.")
    if any(not isinstance(password, str) or not 8 <= len(password) <= 256
           for password in passwords.values()):
        raise ValueError("Hasła muszą mieć od 8 do 256 znaków.")
    records = {username: password_record(password) for username, password in passwords.items()}
    migration = Path(__file__).with_suffix(".sql").read_text()
    with connection() as db:
        db.execute("SET LOCAL lock_timeout = '5s'")
        db.execute("SELECT pg_advisory_xact_lock(149052983)")
        # Block concurrent journal writes only for this short transaction.
        db.execute("LOCK TABLE quest_journal IN SHARE MODE")
        before = db.execute("SELECT current_data, previous_data FROM quest_journal WHERE id = 1").fetchone()
        legacy = db.execute(
            "SELECT username, salt, password_digest FROM quest_accounts WHERE username IN ('edi', 'mama') ORDER BY username"
        ).fetchall()
        if before is None or [row[0] for row in legacy] != ["edi", "mama"]:
            raise ValueError("Nie znaleziono istniejącego dziennika i kont Edi/Mama.")
        db.execute(migration, prepare=False)
        for username, record in records.items():
            db.execute(
                "INSERT INTO quest_accounts (username, salt, password_digest) VALUES (%s, %s, %s) ON CONFLICT (username) DO NOTHING",
                (username, record["salt"], record["hash"]),
            )
            saved = db.execute(
                "SELECT salt, password_digest FROM quest_accounts WHERE username = %s", (username,),
            ).fetchone()
            if not hmac.compare_digest(saved[1], password_hash(passwords[username], saved[0])):
                raise ValueError(f"Konto {username} już istnieje z innym hasłem; nie zmieniono go.")
            db.execute(
                "INSERT INTO quest_personal_journals (username, current_data, previous_data) VALUES (%s, %s, %s) ON CONFLICT (username) DO NOTHING",
                (username, b"null", b"null"),
            )
        after = db.execute("SELECT current_data, previous_data FROM quest_journal WHERE id = 1").fetchone()
        legacy_after = db.execute(
            "SELECT username, salt, password_digest FROM quest_accounts WHERE username IN ('edi', 'mama') ORDER BY username"
        ).fetchall()
        if after != before or legacy_after != legacy:
            raise ValueError("Weryfikacja istniejących danych nie powiodła się; transakcja wycofana.")
    return list(NEW_ACCOUNTS)


if __name__ == "__main__":
    try:
        passwords = {}
        for username, name in NEW_ACCOUNTS.items():
            passwords[username] = getpass(f"Hasło dla {name}: ")
            if passwords[username] != getpass("Powtórz hasło: "):
                raise ValueError("Hasła się różnią.")
        provision_accounts(passwords)
        print("Konta Tola i Mateusz oraz ich osobne dzienniki są gotowe.")
        print("Zweryfikowano zachowanie danych i haseł kont Edi/Mama.")
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from None
