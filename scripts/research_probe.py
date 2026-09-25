"""Reproduce the local research probe; not the MVP coaching engine.

Install requirements-research.txt in a virtual environment. Run from repo root:
  python scripts/research_probe.py
First run downloads small.en; all video/audio processing then runs locally.
Existing transcripts are reused. Outputs stay under the ignored videos folder.
"""

import json
from pathlib import Path

import numpy as np
import parselmouth
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "videos" / ".research"
TRANSCRIPTS = OUTPUT / "transcripts"

# Times are original-video seconds, selected from the lesson review.
# These comparisons are smoke tests, not a labeled coaching benchmark.
PROBES = [
    ("rate_slow_demo", "02-Rate of Speech", 29.63, 39.65),
    ("rate_fast_demo", "02-Rate of Speech", 67.99, 74.85),
    ("volume_strong_demo", "03-Volume", 44.43, 71.39),
    ("volume_quiet_demo", "03-Volume", 81.35, 99.59),
    ("pitch_student_first", "04-Pitch & Melody", 265.66, 278.34),
    ("pitch_student_exercise", "04-Pitch & Melody", 282.72, 299.00),
    ("pause_student_first", "06-Pause", 247.71, 263.19),
    ("pause_student_second", "06-Pause", 273.85, 301.51),
]


def main():
    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
    model = None
    transcripts = {}
    for video in sorted((ROOT / "videos").glob("*.mp4")):
        target = TRANSCRIPTS / f"{video.stem}.json"
        if not target.exists():
            if model is None:
                model = WhisperModel(
                    "small.en", device="cpu", compute_type="int8", cpu_threads=8
                )
            segments, info = model.transcribe(
                str(video), word_timestamps=True, vad_filter=True, beam_size=3
            )
            rows = []
            for segment in segments:
                rows.append({
                    "start": segment.start, "end": segment.end,
                    "text": segment.text,
                    "words": [
                        {"start": w.start, "end": w.end, "word": w.word,
                         "probability": w.probability}
                        for w in (segment.words or [])
                    ],
                })
            target.write_text(json.dumps({
                "file": video.name, "duration": info.duration,
                "language": info.language, "model": "faster-whisper small.en",
                "segments": rows,
            }, indent=2))
        data = json.loads(target.read_text())
        transcripts[video.stem] = data
        target.with_suffix(".txt").write_text("\n".join(
            f'[{s["start"]:.2f}–{s["end"]:.2f}] {s["text"]}'
            for s in data["segments"]
        ) + "\n")

    audio_cache = {}
    results = []
    for probe_id, stem, start, end in PROBES:
        if stem not in audio_cache:
            audio_cache[stem] = decode_audio(str(ROOT / "videos" / f"{stem}.mp4"))
        samples = audio_cache[stem][round(start * 16000):round(end * 16000)]
        pitch = parselmouth.Sound(samples, sampling_frequency=16000).to_pitch(
            time_step=0.01, pitch_floor=65, pitch_ceiling=600
        )
        frequencies = pitch.selected_array["frequency"]
        voiced = frequencies > 0
        f0 = frequencies[voiced]
        # Level of 40 ms windows centered on pitch-voiced frames. This is a
        # consistent local proxy, not calibrated SPL or perceived loudness.
        centers = (pitch.xs()[voiced] * 16000).astype(int)
        rms_db = np.array([
            20 * np.log10(max(float(np.sqrt(np.mean(
                samples[max(0, c - 320):min(len(samples), c + 320)] ** 2
            ))), 1e-12)) for c in centers
        ])
        words = [w for s in transcripts[stem]["segments"] for w in s["words"]
                 if start <= (w["start"] + w["end"]) / 2 < end]
        gaps = [max(0, b["start"] - a["end"])
                for a, b in zip(words, words[1:])]
        results.append({
            "id": probe_id, "file": f"{stem}.mp4", "start": start, "end": end,
            "word_count_asr": len(words),
            "wpm_asr": round(60 * len(words) / (end - start), 1),
            "voiced_fraction": round(float(voiced.mean()), 3),
            "f0_median_hz": round(float(np.median(f0)), 1) if len(f0) else None,
            "f0_p10_p90_semitones": round(float(12 * np.log2(
                np.percentile(f0, 90) / np.percentile(f0, 10)
            )), 2) if len(f0) else None,
            "voiced_rms_median_dbfs": round(float(np.median(rms_db)), 2)
            if len(rms_db) else None,
            "asr_word_gaps_over_0_5s": sum(g > 0.5 for g in gaps),
            "max_asr_word_gap_seconds": round(max(gaps, default=0), 2),
        })
    result = {
        "method": "Local exploratory probe; ASR timing is unverified. Pitch range 65–600 Hz.",
        "limitations": [
            "Word gaps are ASR alignment gaps, not validated acoustic silence.",
            "Pitch and pause student second takes contain coach interjections.",
            "Different passages and edited recordings are not controlled experiments.",
            "No model-generated tone or coaching verdict was tested.",
        ],
        "probes": results,
    }
    (OUTPUT / "probe-results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
