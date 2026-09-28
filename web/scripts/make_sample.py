"""Build the landing page's sample take with macOS `say`.

Each phrase is rendered separately and joined with explicit silences, so the
phrase timings in src/data/sample-take.json are exact rather than estimated.
Run from web/: ../.venv/bin/python scripts/make_sample.py
"""

import json
import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import parselmouth

RATE = 22050
WEB = Path(__file__).resolve().parent.parent
OUT = WEB / "public" / "sample"
DATA = WEB / "src" / "data"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# (segment id, text, say rate in wpm, volume 0-1, silence after in seconds)
PHRASES = [
    ("s1", "For three years, I ran the night shift at a clinic downtown.", 232, 1.0, 0.28),
    ("s2", "And the thing nobody tells you", 180, 1.0, 1.05),
    ("s2", "is that the hardest part isn't the work.", 176, 1.0, 0.7),
    ("s3", "It's saying no.", 118, 1.0, 1.2),
    ("s4", "So tonight, I want to talk about how I learned to say it,", 196, 1.0, 0.12),
    ("s4", "out loud, and mean it.", 196, 0.42, 0.9),
]


def render(text: str, wpm: int, directory: Path, index: int) -> np.ndarray:
    aiff = directory / f"p{index}.aiff"
    subprocess.run(["say", "-v", "Samantha", "-r", str(wpm), "-o", str(aiff), text], check=True)
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(aiff), "-ac", "1", "-ar", str(RATE), "-f", "s16le", "pipe:1"],
        capture_output=True, check=True,
    ).stdout
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    # Trim the renderer's own leading and trailing silence.
    loud = np.flatnonzero(np.abs(samples) > 0.01)
    return samples[loud[0]: loud[-1] + 1] if loud.size else samples


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pieces, segments, cursor = [np.zeros(int(0.35 * RATE), np.float32)], {}, 0.35
    with tempfile.TemporaryDirectory() as tmp:
        for index, (seg_id, text, wpm, volume, gap) in enumerate(PHRASES):
            audio = render(text, wpm, Path(tmp), index) * volume
            start, end = cursor, cursor + len(audio) / RATE
            words = text.split()
            weights = np.array([len(w) + 1 for w in words], dtype=float)
            edges = start + np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * (end - start)
            seg = segments.setdefault(seg_id, {"id": seg_id, "start": round(start, 2), "text": "", "words": []})
            seg["text"] = (seg["text"] + " " + text).strip()
            seg["end"] = round(end, 2)
            seg["words"] += [{"text": w, "start": round(a, 2), "end": round(b, 2)} for w, a, b in zip(words, edges, edges[1:])]
            pieces += [audio, np.zeros(int(gap * RATE), np.float32)]
            cursor = end + gap
    take = np.concatenate(pieces)
    pcm = (np.clip(take, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(
        [FFMPEG, "-y", "-v", "error", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", "64k", str(OUT / "take.mp3")],
        input=pcm, check=True,
    )
    bins = 480
    frames = np.array_split(np.abs(take), bins)
    peaks = np.array([f.max() if f.size else 0 for f in frames])
    peaks = peaks / peaks.max()
    # Lane measurements. Volume is recorded level, not room loudness.
    rms = np.array([np.sqrt(np.mean(f ** 2)) if f.size else 0 for f in np.array_split(take, bins)])
    volume = rms / rms.max()
    pitch = parselmouth.Sound(take.astype(np.float64), RATE).to_pitch(time_step=len(take) / RATE / bins)
    hz = pitch.selected_array["frequency"]
    hz = np.interp(np.linspace(0, len(hz) - 1, bins), np.arange(len(hz)), hz)
    voiced = hz > 0
    semis = np.where(voiced, 12 * np.log2(np.where(voiced, hz, 1) / np.median(hz[voiced])), np.nan)
    semis[np.abs(semis) > 12] = np.nan  # octave jumps and tracking errors
    ordered = list(segments.values())
    pauses = [{"start": a["end"], "end": b["start"]} for a, b in zip(ordered, ordered[1:])]
    for s in ordered:
        inner = [(w1["end"], w2["start"]) for w1, w2 in zip(s["words"], s["words"][1:]) if w2["start"] - w1["end"] > 0.3]
        pauses += [{"start": a, "end": b} for a, b in inner]
        s["wpm"] = round(len(s["words"]) / (s["end"] - s["start"]) * 60)
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "sample-take.json").write_text(json.dumps({
        "duration": round(len(take) / RATE, 2),
        "peaks": [round(float(p), 3) for p in peaks],
        "volume": [round(float(v), 3) for v in volume],
        "pitch": [None if np.isnan(v) else round(float(v), 2) for v in semis],
        "pauses": sorted(pauses, key=lambda p: p["start"]),
        "segments": ordered,
    }, indent=1))
    print("duration", round(len(take) / RATE, 2), [(s["id"], s["start"], s["end"]) for s in segments.values()])


if __name__ == "__main__":
    main()
