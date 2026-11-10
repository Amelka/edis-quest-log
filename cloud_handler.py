import os

import cloud_store
from server import Handler


class CloudHandler(Handler):
    read_journal = staticmethod(cloud_store.read_journal)
    save_journal = staticmethod(cloud_store.save_journal)
    login = staticmethod(cloud_store.login)
    account = staticmethod(cloud_store.account)
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
