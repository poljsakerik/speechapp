import json
import subprocess
import wave
from io import BytesIO
from unittest.mock import patch

import numpy as np
import pytest
import imageio_ffmpeg
import httpx
from mistralai.client.errors import SDKError

from speechapp.acoustics import measure
from speechapp.audio import REVIEW_DURATION_SECONDS, SAMPLE_RATE, prepare_audio
from speechapp.coach import review
from speechapp.pipeline import analyze
from scripts.compare_reviews import rater_view


def _wav(samples):
    out = BytesIO()
    with wave.open(out, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(SAMPLE_RATE)
        file.writeframes((samples * 32767).astype("<i2").tobytes())
    return out.getvalue()


def _segment():
    return {"id": "s1", "start": 0.0, "end": 2.0, "text": "A useful point.",
            "words": [{"text": "A", "start": 0, "end": 0.4},
                      {"text": "useful", "start": 0.6, "end": 1.1},
                      {"text": "point.", "start": 1.2, "end": 2.0}]}


def test_audio_preserves_original_time_and_relative_level():
    t = np.arange(SAMPLE_RATE * 2) / SAMPLE_RATE
    signal = (np.sin(2 * np.pi * 180 * t) * np.where(t < 1, 0.2, 0.05)).astype(np.float32)
    decoded, wav, mp3 = prepare_audio(_wav(signal))
    assert len(decoded) == len(signal)
    assert wav.startswith(b"RIFF")
    assert mp3
    sections = [_segment(), {**_segment(), "id": "s2", "start": 1, "end": 2}]
    sections[0]["end"] = 1
    sections[0]["words"] = sections[0]["words"][:1]
    sections[1]["words"] = sections[1]["words"][-1:]
    measured = measure(decoded, sections)
    assert measured[0]["features"]["relative_level_db"] > 0
    assert measured[1]["features"]["relative_level_db"] < 0


def test_audio_uses_centered_one_minute():
    signal = np.concatenate([
        np.full(3 * SAMPLE_RATE, 0.1, dtype=np.float32),
        np.full(REVIEW_DURATION_SECONDS * SAMPLE_RATE, 0.2, dtype=np.float32),
        np.full(3 * SAMPLE_RATE, 0.3, dtype=np.float32),
    ])
    samples, _, mp3 = prepare_audio(_wav(signal))
    assert len(samples) == REVIEW_DURATION_SECONDS * SAMPLE_RATE
    assert np.allclose(samples, 0.2, atol=0.001)
    assert len(mp3) < 256_000


def test_mp4_with_end_index_decodes_from_seekable_source(tmp_path):
    path = tmp_path / "speech.mp4"
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-f", "lavfi", "-i",
        "sine=frequency=220:duration=2", "-c:a", "aac", str(path)
    ], check=True)
    samples, wav, mp3 = prepare_audio(path.read_bytes())
    assert abs(len(samples) - 2 * SAMPLE_RATE) < SAMPLE_RATE // 10
    assert wav.startswith(b"RIFF") and mp3


def test_review_returns_raw_json_without_claim_validation(monkeypatch):
    monkeypatch.delenv("MISTRAL_MODEL", raising=False)
    raw = {"overall": "You spoke at 90 WPM", "assessments": [
        {"foundation": "rate", "findings": [
            {"segment_id": "missing", "feature_ids": ["imaginary_measure"]}
        ]}
    ]}
    with patch("speechapp.coach.Mistral") as client:
        client.return_value.chat.complete.return_value.choices = [
            type("Choice", (), {"message": type("Message", (), {"content": json.dumps(raw)})()})()
        ]
        assert review(b"audio", [{**_segment(), "features": {}}], "fake") == raw
        request = client.return_value.chat.complete.call_args.kwargs
        assert request["model"] == "voxtral-small-2507"
        assert request["response_format"] == {"type": "json_object"}
        assert request["messages"][0]["content"][0] == {
            "type": "input_audio", "input_audio": "YXVkaW8="
        }


def test_rate_limit_has_actionable_message():
    response = httpx.Response(429, request=httpx.Request("POST", "https://api.mistral.ai/v1/chat/completions"))
    with patch("speechapp.coach.Mistral") as client:
        client.return_value.chat.complete.side_effect = SDKError("API error occurred", response)
        with pytest.raises(RuntimeError, match="check API limits"):
            review(b"audio", [{**_segment(), "features": {}}], "fake")
        retry = client.call_args.kwargs["retry_config"]
        assert retry.strategy == "backoff"
        assert retry.backoff.max_elapsed_time == 12_000


def test_pauses_between_segments_are_measured_but_not_assumed():
    t = np.arange(SAMPLE_RATE * 2) / SAMPLE_RATE
    signal = np.sin(2 * np.pi * 180 * t).astype(np.float32) * 0.2
    signal[int(0.5 * SAMPLE_RATE):int(1.5 * SAMPLE_RATE)] = 0
    first = {"id": "s1", "start": 0, "end": 0.5, "text": "First",
             "words": [{"text": "First", "start": 0, "end": 0.5}]}
    second = {"id": "s2", "start": 1.5, "end": 2, "text": "Second",
              "words": [{"text": "Second", "start": 1.5, "end": 2}]}
    measured = measure(signal, [first, second])
    assert measured[0]["features"]["pause_count"] == 1
    assert measured[0]["features"]["pauses"][0]["between_segments"] is True
    assert measured[0]["features"]["pauses"][0]["seconds"] == 1.0
    signal[int(0.5 * SAMPLE_RATE):int(1.5 * SAMPLE_RATE)] = 0.2 * np.sin(
        2 * np.pi * 180 * t[int(0.5 * SAMPLE_RATE):int(1.5 * SAMPLE_RATE)]
    )
    assert measure(signal, [first, second])[0]["features"]["pause_count"] == 0


def test_rater_view_hides_condition_metadata_without_changing_review():
    raw = {"overall": "Fine", "assessments": [{"findings": [
        {"practice": "Try again", "feature_ids": ["rate_wpm"]}
    ]}]}
    blinded = rater_view(raw)
    assert "feature_ids" not in blinded["assessments"][0]["findings"][0]
    assert raw["assessments"][0]["findings"][0]["feature_ids"] == ["rate_wpm"]


def test_upload_pipeline_connects_audio_transcript_measurements_and_review(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "deepgram-test")
    monkeypatch.setenv("MISTRAL_API_KEY", "mistral-test")
    sample = np.zeros(SAMPLE_RATE * 2, dtype=np.float32)
    with patch("speechapp.pipeline.transcribe", return_value=[_segment()]) as asr, \
         patch("speechapp.pipeline.review", return_value="reviewed") as reviewer:
        result = analyze(_wav(sample))
    assert result["review"] == "reviewed"
    assert len(result["segments"]) == 1
    assert "rate_wpm" in result["segments"][0]["features"]
    assert asr.call_args.args[1] == "deepgram-test"
    assert reviewer.call_args.args[2] == "mistral-test"
    assert reviewer.call_args.args[0].startswith(b"ID3")
