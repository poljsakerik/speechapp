"""Prepare blinded direct-audio vs acoustic-assisted reviews for fresh recordings.

Usage: python -m scripts.compare_reviews recordings/*.wav
Requires Deepgram and Mistral credentials. Output stays outside this repository by default.
"""

import argparse
from copy import deepcopy
import json
import os
from pathlib import Path
import random

from dotenv import load_dotenv

from speechapp.acoustics import measure
from speechapp.audio import prepare_audio
from speechapp.coach import review
from speechapp.transcribe import transcribe

load_dotenv()


def rater_view(result) -> dict:
    """Keep the same fields in both conditions; hide acoustic metadata."""
    data = deepcopy(result)
    def remove_feature_ids(value):
        if isinstance(value, dict):
            value.pop("feature_ids", None)
            for item in value.values():
                remove_feature_ids(item)
        elif isinstance(value, list):
            for item in value:
                remove_feature_ids(item)
    remove_feature_ids(data)
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("recordings", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, default=Path("/tmp/speechapp-comparison"))
    args = parser.parse_args()
    if len(args.recordings) != 10:
        parser.error("Supply exactly 10 recordings (five pairs) for the planned pilot.")
    args.output.mkdir(parents=True, exist_ok=True)
    rater_packet = args.output / "rater-packet"
    rater_packet.mkdir(exist_ok=True)
    rng = random.Random(20260925)
    key = []
    for number, path in enumerate(args.recordings, 1):
        samples, wav, mp3 = prepare_audio(path.read_bytes())
        segments = measure(samples, transcribe(wav, os.environ["DEEPGRAM_API_KEY"]))
        (rater_packet / f"clip-{number:02d}.mp3").write_bytes(mp3)
        conditions = [False, True]
        rng.shuffle(conditions)
        for blind_label, with_features in zip(("A", "B"), conditions):
            result = review(mp3, segments, os.environ["MISTRAL_API_KEY"],
                            with_features=with_features)
            target = rater_packet / f"clip-{number:02d}-{blind_label}.json"
            target.write_text(json.dumps({
                "audio": f"clip-{number:02d}.mp3",
                "transcript": [{"id": s["id"], "start": s["start"], "end": s["end"],
                                "text": s["text"]} for s in segments],
                "review": rater_view(result),
            }, indent=2))
            key.append({"clip": number, "label": blind_label,
                        "condition": "hybrid" if with_features else "direct_audio",
                        "source": str(path)})
    (args.output / "private-answer-key.json").write_text(json.dumps(key, indent=2))
    print(f"Share only {rater_packet} with raters. Keep the answer key private.")


if __name__ == "__main__":
    main()
