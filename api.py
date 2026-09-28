"""HTTP wrapper for the review pipeline, used by the web app's free review.

Run with: .venv/bin/uvicorn api:app --port 8000
The web dev server proxies /api to this port. Uploads are reviewed in memory
and not stored.
"""

import base64

from fastapi import FastAPI, File, HTTPException, UploadFile

from speechapp.pipeline import analyze

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ACCEPTED = {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/webm",
            "audio/ogg", "video/mp4", "video/webm", "video/quicktime"}

app = FastAPI(title="MicMane review")


@app.post("/api/review")
async def review(file: UploadFile = File(...)) -> dict:
    content_type = (file.content_type or "").split(";")[0]
    if content_type not in ACCEPTED:
        raise HTTPException(415, "Use a WAV, MP3, M4A, MP4 or WebM recording.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "That file is larger than 25 MB.")
    try:
        result = analyze(data)
    except RuntimeError as exc:  # Mistral rate limit, see speechapp/coach.py
        raise HTTPException(429, str(exc)) from exc
    except ValueError as exc:  # no decodable audio or not enough speech
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, "The review could not be completed.") from exc
    segments = [{k: v for k, v in s.items() if k != "features"} for s in result["segments"]]
    return {
        "audio": base64.b64encode(result["audio"]).decode("ascii"),
        "segments": segments,
        "review": result["review"],
    }
