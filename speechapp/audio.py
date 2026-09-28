"""Select a centered excerpt and make in-memory transcription and listening copies."""

import io
import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

SAMPLE_RATE = 16000
REVIEW_DURATION_SECONDS = 60


def prepare_audio(source: bytes) -> tuple[np.ndarray, bytes, bytes]:
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    # MP4/M4A may keep their media index at the end of the file. FFmpeg must
    # be able to seek while decoding; stdin is not a reliable input for them.
    with tempfile.TemporaryDirectory(prefix="speechapp-audio-") as directory:
        input_path = Path(directory) / "recording"
        raw_path = Path(directory) / "decoded.pcm"
        input_path.write_bytes(source)
        subprocess.run(
            [exe, "-v", "error", "-i", str(input_path), "-vn", "-ac", "1",
             "-ar", str(SAMPLE_RATE), "-f", "s16le", str(raw_path)],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True,
        )
        total_samples = raw_path.stat().st_size // 2
        if not total_samples:
            raise ValueError("The recording contains no decodable audio.")
        excerpt_samples = min(total_samples, REVIEW_DURATION_SECONDS * SAMPLE_RATE)
        start_sample = (total_samples - excerpt_samples) // 2
        with raw_path.open("rb") as raw:
            raw.seek(start_sample * 2)
            decoded = raw.read(excerpt_samples * 2)
    samples = np.frombuffer(decoded, dtype="<i2").astype(np.float32) / 32768
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(decoded)
    mp3 = subprocess.run(
        [exe, "-v", "error", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1",
         "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "32k", "-f", "mp3", "pipe:1"],
        input=decoded, capture_output=True, check=True,
    ).stdout
    return samples, wav_buffer.getvalue(), mp3
