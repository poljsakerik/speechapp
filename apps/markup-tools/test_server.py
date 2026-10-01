import importlib.util
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location("server", Path(__file__).with_name("server.py"))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class AnnotationAPI(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        server.RECORDINGS = Path(self.temp.name).resolve()
        self.base = server.RECORDINGS / "rate/rate-01/rate-01"
        self.base.parent.mkdir(parents=True)
        Path(f"{self.base}.txt").write_text("One two.")
        Path(f"{self.base}.wav").write_bytes(b"0123456789")
        self.initial = {"schemaVersion": 2, "marks": [], "reviews": {}}
        Path(f"{self.base}.golden.json").write_text(json.dumps(self.initial))
        (server.RECORDINGS / "manifest.json").write_text(json.dumps({"schemaVersion": 1, "takes": [{"id": "rate-01", "base": "rate/rate-01/rate-01", "duration": 3}]}))
        self.http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.http.server_port}"

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.temp.cleanup()

    def put(self, body):
        return urllib.request.urlopen(urllib.request.Request(self.url + "/api/golden/rate-01", data=json.dumps(body).encode(), method="PUT", headers={"Content-Type": "application/json"}))

    def test_review_status_and_notes_survive_mark_edits(self):
        body = {**self.initial, "reviews": {"rate": {"status": "reviewed", "notes": "good"}}}
        with self.put(body) as response:
            self.assertEqual(json.load(response)["reviews"]["rate"]["status"], "reviewed")
        body["marks"] = [{"startAt": 0, "endAt": 1, "startIndex": 0, "endIndex": 3, "foundationType": "rate", "rule": "RATE_IMPORTANCE_FAST", "note": "Draft comparison against the good take."}]
        with self.put(body) as response:
            self.assertEqual(json.load(response)["reviews"]["rate"]["status"], "reviewed")
        body["reviews"]["rate"]["status"] = "reviewed"
        with self.put(body) as response:
            self.assertEqual(json.load(response)["reviews"]["rate"]["status"], "reviewed")
        saved = json.loads(Path(f"{self.base}.golden.json").read_text())
        self.assertEqual(saved, body)

    def test_invalid_write_does_not_damage_annotation(self):
        for body in ([], {**self.initial, "reviews": {"rate": {"status": "guess", "notes": ""}}}, {**self.initial, "marks": [{"foundationType": "rate", "rule": "RATE_IMPORTANCE_FAST", "startAt": float("nan")}]}):
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.put(body)
            self.assertEqual(error.exception.code, 400)
        self.assertEqual(json.loads(Path(f"{self.base}.golden.json").read_text()), self.initial)

    def test_audio_seeking_and_path_confinement(self):
        url = self.url + "/recordings/rate/rate-01/rate-01.wav"
        for byte_range, expected in (("bytes=2-5", b"2345"), ("bytes=-3", b"789"), ("bytes=-100", b"0123456789")):
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Range": byte_range})) as response:
                self.assertEqual(response.status, 206)
                self.assertEqual(response.read(), expected)
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(urllib.request.Request(url, headers={"Range": "bytes=100-"}))
        self.assertEqual(error.exception.code, 416)
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(self.url + "/recordings/%2e%2e/server.py")
        self.assertEqual(error.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
