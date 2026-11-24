"""Exercise the cloud HTTP routing and real SQL persistence with isolated data."""
import json
import sqlite3
import unittest
from contextlib import contextmanager
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import cloud_store
from cloud_handler import CloudHandler
from server import revision


class SQLDatabase:
    def __init__(self, db):
        self.db = db

    def execute(self, sql, params=()):
        return self.db.execute(sql.replace("%s", "?").replace(" FOR UPDATE", ""), params)


class PersonalJournalsTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.addCleanup(self.db.close)
        self.db.executescript("""
            CREATE TABLE quest_journal (id INTEGER PRIMARY KEY, current_data BLOB, previous_data BLOB);
            CREATE TABLE quest_personal_journals (username TEXT PRIMARY KEY, current_data BLOB, previous_data BLOB);
        """)
        self.legacy = self.journal(60)
        self.db.execute("INSERT INTO quest_journal VALUES (1, ?, ?)", (self.legacy, self.legacy))
        for username in ("tola", "mateusz"):
            self.db.execute("INSERT INTO quest_personal_journals VALUES (?, ?, ?)", (username, b"null", b"null"))

        @contextmanager
        def connection():
            yield SQLDatabase(self.db)

        self.connection_patch = patch.object(cloud_store, "connection", connection)
        self.connection_patch.start()
        self.addCleanup(self.connection_patch.stop)
        self.auth_patch = patch.object(cloud_store, "account", lambda token: {
            "edi-token": "Edi", "mama-token": "Mama", "tola-token": "Tola", "mateusz-token": "Mateusz",
        }.get(token))
        self.auth_patch.start()
        self.addCleanup(self.auth_patch.stop)

        class Handler(CloudHandler):
            endpoint = "journal"

            def valid_host(self):
                return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

            def log_message(self, *args):
                pass

        self.http = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory="dist"))
        thread = Thread(target=self.http.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.http.server_close)
        self.addCleanup(thread.join)
        self.addCleanup(self.http.shutdown)
        self.origin = f"http://127.0.0.1:{self.http.server_port}"

    @staticmethod
    def journal(xp):
        return json.dumps(dict(quests=[], performances=[], sessions=[], revealed=[], completed={"xp": xp})).encode()

    def request(self, account, body=None, tag=None, expected=None, token=None):
        headers = {"Cookie": f"__Secure-edi_session={token or account.casefold() + '-token'}",
                   "Origin": self.origin.replace("http:", "https:")}
        if expected is not False:
            headers["X-Journal-Account"] = account if expected is None else expected
        if body is not None:
            headers["X-Journal-Revision"] = tag
        request = Request(self.origin + "/api/journal", data=body, headers=headers,
                          method="GET" if body is None else "PUT")
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, response.read(), response.headers["X-Journal-Revision"]
        except HTTPError as error:
            with error:
                return error.code, None, None

    def test_separate_journals_keep_legacy_history_and_backups(self):
        for name in ("Tola", "Mateusz"):
            self.assertEqual(self.request(name)[:2], (200, b"null"))
        self.assertEqual(self.request("Edi")[1], self.legacy)
        self.assertEqual(self.request("Mama")[1], self.legacy)
        for name, xp in (("Tola", 10), ("Mateusz", 20), ("Mama", 70)):
            tag = self.request(name)[2]
            body = self.journal(xp)
            self.assertEqual(self.request(name, body, tag)[:2], (200, body))
        self.assertEqual(self.request("Tola")[1], self.journal(10))
        self.assertEqual(self.request("Mateusz")[1], self.journal(20))
        self.assertEqual(self.request("Edi")[1], self.journal(70))
        tola = self.request("Tola")
        self.assertEqual(self.request("Tola", self.journal(30), tola[2])[0], 200)
        self.assertEqual(self.request("Tola", self.journal(40), tola[2])[0], 412)
        self.assertEqual(bytes(self.db.execute("SELECT previous_data FROM quest_personal_journals WHERE username = 'tola'").fetchone()[0]), self.journal(10))
        self.assertEqual(bytes(self.db.execute("SELECT previous_data FROM quest_journal WHERE id = 1").fetchone()[0]), self.legacy)

    def test_cookie_switch_cannot_read_or_write_another_account(self):
        empty = revision(b"null")
        for old, current in (("Tola", "Mateusz"), ("Edi", "Tola"), ("Tola", "Edi")):
            token = current.casefold() + "-token"
            self.assertEqual(self.request(old, token=token)[0], 401)
            self.assertEqual(self.request(old, self.journal(100), empty, token=token)[0], 401)
        self.assertEqual(self.request("Tola", expected="Mateusz")[0], 401)
        self.assertEqual(self.request("Tola", token="invalid")[0], 401)
        self.assertEqual(self.request("Tola")[1], b"null")
        self.assertEqual(self.request("Mateusz")[1], b"null")
        self.assertEqual(self.request("Edi")[1], self.legacy)

    def test_personal_accounts_require_tab_identity_legacy_clients_still_read(self):
        self.assertEqual(self.request("Tola", expected=False)[0], 401)
        self.assertEqual(self.request("Mateusz", expected=False)[0], 401)
        self.assertEqual(self.request("Edi", expected=False)[0], 200)
        self.assertEqual(self.request("Mama", expected=False)[0], 200)

    def test_unknown_owner_never_falls_back_to_shared_journal(self):
        for account in (None, "", "unknown", "tola", "edi"):
            with self.assertRaises(OSError):
                cloud_store.read_journal(account)
            with self.assertRaises(OSError):
                cloud_store.save_journal(self.journal(1), revision(b"null"), account)
