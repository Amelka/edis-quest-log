import json
import subprocess
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class JournalTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.data = Path(directory.name)
        self.start_server()

    def start_server(self):
        self.server = subprocess.Popen(
            [sys.executable, "-B", str(Path(__file__).with_name("serve.py")), str(self.data)],
            stdout=subprocess.PIPE, text=True,
        )
        self.addCleanup(self.stop_server, self.server)
        self.origin = self.server.stdout.readline().strip()
        self.assertTrue(self.origin.startswith("http://127.0.0.1:"))
        self.cookie = self.login("Edi", "test-edi-password")

    def login(self, username, password):
        request = Request(self.origin + "/api/login",
                          data=json.dumps(dict(username=username, password=password)).encode(),
                          headers={"Origin": self.origin, "Content-Type": "application/json"})
        with urlopen(request, timeout=5) as response:
            return response.headers["Set-Cookie"].split(";", 1)[0]

    @staticmethod
    def stop_server(server):
        if server.poll() is None:
            server.terminate()
        server.wait(timeout=5)
        server.stdout.close()

    def request(self, body=None, tag=None, origin=None, cookie=None, revision_header="X-Journal-Revision"):
        headers = {"Cookie": self.cookie if cookie is None else cookie}
        if body is not None:
            headers.update({revision_header: tag, "Origin": origin or self.origin,
                            "Content-Type": "application/json"})
        request = Request(self.origin + "/api/journal", data=body, headers=headers,
                          method="GET" if body is None else "PUT")
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response), response.headers["X-Journal-Revision"]
        except HTTPError as error:
            with error:
                return error.code, None, None

    @staticmethod
    def journal(xp):
        return json.dumps(dict(quests=[], performances=[], sessions=[], revealed=[],
                               completed={"performance": xp})).encode()

    def test_read_save_restart_and_backup(self):
        status, log, tag = self.request()
        self.assertEqual((status, log), (200, None))
        self.assertTrue(tag)
        first, second = self.journal(20), self.journal(30)
        status, log, next_tag = self.request(first, tag)
        self.assertEqual((status, log), (200, json.loads(first)))
        self.assertNotEqual(next_tag, tag)
        saved = self.request(second, next_tag)
        self.assertEqual(saved[:2], (200, json.loads(second)))
        self.stop_server(self.server)
        self.start_server()
        self.assertEqual(self.request(), saved)
        self.assertEqual((self.data / "journal.previous.json").read_bytes(), first)

    def test_concurrent_writes_keep_the_winner(self):
        _, _, tag = self.request()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda xp: self.request(self.journal(xp), tag), (20, 30)))
        self.assertEqual(sorted(result[0] for result in results), [200, 412])
        self.assertEqual(self.request(), next(result for result in results if result[0] == 200))

    def test_invalid_requests_leave_journal_untouched(self):
        _, _, tag = self.request()
        saved = self.request(self.journal(20), tag)
        self.assertEqual(saved[0], 200)
        self.assertEqual(self.request(b"{", saved[2])[0], 400)
        self.assertEqual(self.request(self.journal(30), saved[2], "http://example.test")[0], 403)
        self.assertEqual(self.request(), saved)
        self.assertEqual((self.data / "journal.previous.json").read_bytes(), self.journal(20))

    def test_accounts_share_journal_and_anonymous_requests_are_blocked(self):
        self.assertEqual(self.request(cookie="")[0], 401)
        _, _, tag = self.request()
        self.assertEqual(self.request(self.journal(20), tag, cookie="")[0], 401)
        mama = self.login("Mama", "test-mama-password")
        saved = self.request(self.journal(30), tag, cookie=mama)
        self.assertEqual(saved[:2], (200, json.loads(self.journal(30))))
        self.assertEqual(self.request(), saved)
        with self.assertRaises(HTTPError) as bad_password:
            self.login("Mama", "wrong password")
        self.assertEqual(bad_password.exception.code, 401)
        bad_password.exception.close()

        logout = Request(self.origin + "/api/logout", method="POST",
                         headers={"Origin": self.origin, "Cookie": mama})
        with urlopen(logout, timeout=5) as response:
            self.assertEqual(response.status, 200)
        self.assertEqual(self.request(cookie=mama)[0], 401)
        self.assertEqual(self.request(), saved)

    def test_legacy_if_match_still_works(self):
        _, _, tag = self.request()
        self.assertEqual(self.request(self.journal(20), tag, revision_header="If-Match")[0], 200)
