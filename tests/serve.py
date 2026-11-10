"""Run the production handler on a system-assigned port with test data."""
import json
import os
import sys
from functools import partial
from pathlib import Path

data = Path(sys.argv[1]).resolve()
os.environ["EDI_QUEST_DATA_DIR"] = str(data)
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

import server

if not server.CREDENTIALS.exists():
    server.CREDENTIALS.write_text(json.dumps({
        "edi": server.password_record("test-edi-password"),
        "mama": server.password_record("test-mama-password"),
    }))

with server.ThreadingHTTPServer(
    ("127.0.0.1", 0), partial(server.Handler, directory=str(root / "dist"))
) as http:
    address = f"127.0.0.1:{http.server_port}"
    server.LOCAL_HOSTS = {address}
    print(f"http://{address}", flush=True)
    http.serve_forever()
