"""Local voice-pack annotator; run with python3 apps/markup-tools/server.py."""

import json
import math
import os
import re
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
RECORDINGS = Path(os.environ.get("RECORDINGS_DIR", ROOT.parents[1] / "recordings")).resolve()
PORT = int(os.environ.get("PORT", "8765"))
RULES = {
    "rate": {"RATE_IMPORTANCE_FAST", "RATE_IMPORTANCE_SLOW"},
    "volume": {"VOLUME_LOW", "VOLUME_FADE", "VOLUME_HIGH"},
    "pitch_melody": {"PITCH_LOW", "PITCH_HIGH", "PITCH_VARIETY"},
    "tonality": {"TONE_FLAT"},
    "pauses": {"PAUSE_NECESSARY", "PAUSE_UNNECESSARY", "PAUSE_FILLERS"},
}


def corpus():
    path = RECORDINGS / "manifest.json"
    return json.loads(path.read_text()) if path.exists() else {"schemaVersion": 1, "id": None, "takes": []}


def take_base(take):
    base = (RECORDINGS / take["base"]).resolve()
    if RECORDINGS not in base.parents:
        raise ValueError("Invalid take path")
    return base


def golden_path(take):
    return Path(f"{take_base(take)}.golden.json")


def validate_annotation(body, take):
    if not isinstance(body, dict) or body.get("schemaVersion") != 2:
        raise ValueError("Expected schemaVersion 2 annotation")
    marks, reviews = body.get("marks"), body.get("reviews")
    if not isinstance(marks, list) or not isinstance(reviews, dict):
        raise ValueError("Expected marks array and reviews object")
    text = Path(f"{take_base(take)}.txt").read_text()
    for m in marks:
        if not isinstance(m, dict) or m.get("rule") not in RULES.get(m.get("foundationType"), set()):
            raise ValueError("Unknown foundation or rule")
        if "note" in m and not isinstance(m["note"], str):
            raise ValueError("Mark note must be text")
        for k in ("startAt", "endAt", "startIndex", "endIndex"):
            if type(m.get(k)) not in (int, float) or not math.isfinite(m[k]):
                raise ValueError("Mark bounds must be finite numbers")
        if type(m["startIndex"]) is not int or type(m["endIndex"]) is not int:
            raise ValueError("Character indexes must be integers")
        if not (0 <= m["startAt"] < m["endAt"] <= take["duration"] + 0.02):
            raise ValueError("Mark outside audio")
        if not (0 <= m["startIndex"] < m["endIndex"] <= len(text)):
            raise ValueError("Mark outside transcript")
    for foundation, review in reviews.items():
        if foundation not in RULES or not isinstance(review, dict) or review.get("status") not in ("pending", "reviewed", "excluded") or not isinstance(review.get("notes"), str):
            raise ValueError("Invalid review")
    # Preserve explicit review decisions and notes when editing marks.
    return {"schemaVersion": 2, "marks": marks, "reviews": reviews}


def save_annotation(path, body):
    # A reader sees either the old complete annotation or the new complete one.
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as f:
        temp = Path(f.name)
        json.dump(body, f, indent=2, allow_nan=False)
        f.write("\n")
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path in ("/", "/index.html"):
            return self.send_file(ROOT / "index.html", "text/html; charset=utf-8")
        if path == "/api/recordings":
            return self.send_json(corpus())
        if path == "/api/golden":
            return self.send_json({t["id"]: json.loads(golden_path(t).read_text()) for t in corpus()["takes"]})
        if path.startswith("/recordings/"):
            file = (RECORDINGS / path.removeprefix("/recordings/")).resolve()
            if RECORDINGS not in file.parents or not file.is_file():
                return self.send_error(404)
            return self.send_range(file)
        self.send_error(404)

    def do_PUT(self):
        match = re.fullmatch(r"/api/golden/([a-z_]+-\d+)", self.path)
        take = next((t for t in corpus()["takes"] if match and t["id"] == match[1]), None)
        if not take:
            return self.send_error(404)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 1_000_000:
                raise ValueError("Invalid request size")
            body = validate_annotation(json.loads(self.rfile.read(size)), take)
        except (ValueError, TypeError, KeyError) as error:
            return self.send_error(400, str(error))
        save_annotation(golden_path(take), body)
        self.send_json(body)

    def send_json(self, data):
        self.send_bytes(json.dumps(data).encode(), "application/json")

    def send_file(self, file, content_type):
        self.send_bytes(file.read_bytes(), content_type)

    def send_bytes(self, raw, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def send_range(self, file):
        size = file.stat().st_size
        start, end = 0, size - 1
        header = self.headers.get("Range")
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", header or "")
        if header:
            if match and (match[1] or match[2]):
                if match[1]:
                    start = int(match[1])
                    end = min(int(match[2]), end) if match[2] else end
                else:
                    start = max(0, size - int(match[2]))
            if not match or not (match[1] or match[2]) or start > end or start >= size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        self.send_response(206 if header else 200)
        self.send_header("Content-Type", self.guess_type(str(file)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(end - start + 1))
        if header:
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
    print(f"Voice-pack annotator on http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
