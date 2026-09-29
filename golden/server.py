"""Local server for the golden-set annotator.

Serves the annotator page, the recordings under ../recordings (with Range
support so the audio player can seek), and saves annotations next to each
recording as <id>.golden.json.

    python golden/server.py   →   http://localhost:8765
"""

import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RECORDINGS = ROOT.parent / "recordings"
PORT = 8765
RECORDING_ID = re.compile(r"^recording-\d+(-[a-z]+)?$")


def recording_ids() -> list[str]:
    return sorted(p.name for p in RECORDINGS.iterdir() if p.is_dir() and RECORDING_ID.match(p.name))


def golden_path(recording_id: str) -> Path:
    return RECORDINGS / recording_id / f"{recording_id}.golden.json"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT.parent), **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            return self.send_file(ROOT / "index.html", "text/html; charset=utf-8")
        if path == "/api/recordings":
            return self.send_json(recording_ids())
        if path == "/api/golden":
            data = {}
            for rid in recording_ids():
                file = golden_path(rid)
                data[rid] = json.loads(file.read_text()) if file.exists() else []
            return self.send_json(data)
        if path.startswith("/recordings/"):
            return self.send_range()
        self.send_error(404)

    def do_PUT(self):
        match = re.fullmatch(r"/api/golden/([^/]+)", self.path)
        if not match or match[1] not in recording_ids():
            return self.send_error(404)
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if not isinstance(body, list):
            return self.send_error(400, "Expected an array of marks")
        golden_path(match[1]).write_text(json.dumps(body, indent=2) + "\n")
        self.send_json({"ok": True})

    def send_json(self, data):
        raw = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def send_file(self, file: Path, content_type: str):
        raw = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def send_range(self):
        file = Path(self.translate_path(self.path))
        if not file.is_file() or RECORDINGS not in file.resolve().parents:
            return self.send_error(404)
        size = file.stat().st_size
        start, end = 0, size - 1
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if match:
            if match[1]:
                start = int(match[1])
                end = int(match[2]) if match[2] else end
            else:
                start = size - int(match[2])
            end = min(end, size - 1)
        self.send_response(206 if match else 200)
        self.send_header("Content-Type", self.guess_type(str(file)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if match:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with file.open("rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(1 << 16, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Golden-set annotator on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
