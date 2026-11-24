import os

import cloud_store
from server import Handler


class CloudHandler(Handler):
    def account(self, token):
        account = cloud_store.account(token)
        # Cookies are shared across tabs. An old tab must never save its log
        # into the account selected by a later login in another tab.
        if self.endpoint == "journal":
            expected = self.headers.get("X-Journal-Account")
            if expected != account and not (expected is None and account in ("Edi", "Mama")):
                return None
        self.journal_account = account
        return account

    def read_journal(self):
        return cloud_store.read_journal(self.journal_account)

    def save_journal(self, data, expected_revision):
        return cloud_store.save_journal(data, expected_revision, self.journal_account)

    login = staticmethod(cloud_store.login)
    logout = staticmethod(cloud_store.logout)
    cookie_name = "__Secure-edi_session"
    secure_cookie = "; Secure"

    def valid_host(self):
        domains = {os.environ.get(name) for name in
                   ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL", "JOURNAL_HOST")}
        domains.discard(None)
        return self.headers.get("Host") in domains

    def same_origin(self):
        host = self.headers.get("Host")
        return self.valid_host() and self.headers.get("Origin") == f"https://{host}"

    def do_GET(self):
        if self.endpoint not in ("journal", "session"):
            return self.send_error(405)
        self.path = f"/api/{self.endpoint}"
        super().do_GET()

    def do_POST(self):
        self.path = f"/api/{self.endpoint}"
        super().do_POST()

    def do_PUT(self):
        self.path = f"/api/{self.endpoint}"
        super().do_PUT()

    def do_HEAD(self):
        self.send_error(405)
