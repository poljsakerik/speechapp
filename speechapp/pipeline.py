"""A single in-memory review; no uploaded audio is persisted by the app."""

import os

from dotenv import load_dotenv

from speechapp.acoustics import measure
from speechapp.audio import prepare_audio
from speechapp.coach import review
from speechapp.transcribe import transcribe

load_dotenv()


def analyze(source: bytes, *, with_features: bool = True) -> dict:
    deepgram_key = os.environ["DEEPGRAM_API_KEY"]
    mistral_key = os.environ["MISTRAL_API_KEY"]
    samples, wav, mp3 = prepare_audio(source)
    segments = transcribe(wav, deepgram_key)
    measure(samples, segments)
    result = review(mp3, segments, mistral_key, with_features=with_features)
    return {"audio": mp3, "segments": segments, "review": result}
