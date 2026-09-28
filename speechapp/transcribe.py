"""Deepgram prerecorded transcription and canonical original-time segments."""

import httpx


def transcribe(wav: bytes, key: str) -> list[dict]:
    response = httpx.post(
        "https://api.deepgram.com/v1/listen",
        params={"model": "nova-3", "language": "en", "utterances": "true", "punctuate": "true"},
        headers={"Authorization": f"Token {key}", "Content-Type": "audio/wav"},
        content=wav, timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    duration = data.get("metadata", {}).get("duration")
    utterances = data.get("results", {}).get("utterances", [])
    segments = []
    for item in utterances:
        start, end = float(item["start"]), float(item["end"])
        if not (0 <= start < end and (duration is None or end <= duration + 0.1)):
            continue
        words = [
            {"text": w.get("punctuated_word", w["word"]), "start": float(w["start"]),
             "end": float(w["end"]), "confidence": float(w.get("confidence", 0))}
            for w in item.get("words", [])
            if start <= float(w["start"]) < float(w["end"]) <= end + 0.1
        ]
        if not words:
            continue
        segments.append({"id": f"s{len(segments) + 1}", "start": start, "end": end,
                         "text": item["transcript"], "words": words})
    if not segments:
        raise ValueError("Deepgram did not detect enough speech to review.")
    return segments
