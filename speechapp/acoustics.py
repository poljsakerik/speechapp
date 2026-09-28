"""Relative, phrase-level acoustic evidence; no coaching verdicts or absolute loudness claims."""

import numpy as np
import parselmouth

from speechapp.audio import SAMPLE_RATE


def _rms_db(samples: np.ndarray) -> float | None:
    if len(samples) == 0:
        return None
    rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    return round(20 * np.log10(max(rms, 1e-8)), 1)


def _pitch_range(samples: np.ndarray) -> float | None:
    if len(samples) < SAMPLE_RATE // 3:
        return None
    f0 = parselmouth.Sound(samples, sampling_frequency=SAMPLE_RATE).to_pitch(
        time_step=0.01, pitch_floor=65, pitch_ceiling=600
    ).selected_array["frequency"]
    voiced = f0[f0 > 0]
    if len(voiced) < 15:
        return None
    # Wider-than-plausible contours often contain octave-tracking errors.
    semitones = 12 * np.log2(np.percentile(voiced, 90) / np.percentile(voiced, 10))
    return round(float(semitones), 1) if semitones < 24 else None


def measure(samples: np.ndarray, segments: list[dict]) -> list[dict]:
    levels = []
    for segment in segments:
        start, end = segment["start"], segment["end"]
        clip = samples[int(start * SAMPLE_RATE):int(end * SAMPLE_RATE)]
        words = segment["words"]
        # Require low signal energy as well as a word-timing gap: ASR gaps alone
        # are not evidence of actual silence.
        pauses = []
        for first, second in zip(words, words[1:]):
            gap_start, gap_end = first["end"], second["start"]
            if gap_end - gap_start < 0.25:
                continue
            gap = samples[int(gap_start * SAMPLE_RATE):int(gap_end * SAMPLE_RATE)]
            gap_db = _rms_db(gap)
            speech_db = _rms_db(clip)
            if gap_db is not None and speech_db is not None and gap_db < speech_db - 10:
                pauses.append({"after_word": first["text"], "seconds": round(gap_end - gap_start, 2)})
        level = _rms_db(clip)
        levels.append(level)
        segment["features"] = {
            "rate_wpm": round(60 * len(words) / (end - start)) if words and end > start else None,
            "pitch_range_semitones": _pitch_range(clip),
            "pause_count": len(pauses),
            "pauses": pauses,
            "level_dbfs": level,
        }
    valid_levels = [value for value in levels if value is not None]
    baseline = float(np.median(valid_levels)) if valid_levels else None
    for segment in segments:
        features = segment["features"]
        features["relative_level_db"] = (
            round(features["level_dbfs"] - baseline, 1)
            if baseline is not None and features["level_dbfs"] is not None else None
        )
        del features["level_dbfs"]
    # Deepgram groups words into utterances. The spaces between those
    # utterances are often the most meaningful pauses, so inspect them too.
    for previous, following in zip(segments, segments[1:]):
        if not previous["words"] or not following["words"]:
            continue
        gap_start = previous["words"][-1]["end"]
        gap_end = following["words"][0]["start"]
        if gap_end - gap_start < 0.25:
            continue
        gap = samples[int(gap_start * SAMPLE_RATE):int(gap_end * SAMPLE_RATE)]
        nearby = samples[int(previous["start"] * SAMPLE_RATE):int(previous["end"] * SAMPLE_RATE)]
        next_clip = samples[int(following["start"] * SAMPLE_RATE):int(following["end"] * SAMPLE_RATE)]
        gap_db = _rms_db(gap)
        speech_levels = [_rms_db(nearby), _rms_db(next_clip)]
        if gap_db is not None and all(level is not None and gap_db < level - 10
                                       for level in speech_levels):
            pause = {"after_word": previous["words"][-1]["text"],
                     "seconds": round(gap_end - gap_start, 2), "between_segments": True}
            previous["features"]["pauses"].append(pause)
            previous["features"]["pause_count"] += 1
    return segments
