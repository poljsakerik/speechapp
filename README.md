# Speech coach prototype

A local upload-and-review app for the five foundations taught in `videos/`: rate, volume, pitch/melody, tonality, and pauses. It combines Deepgram word-timed transcription, local acoustic measurements, and Mistral Voxtral listening. Feedback follows the [lesson rubric](speechapp/rubric.py) and links to the relevant course principles.

## Run

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/streamlit run app.py
```

Edit `.env` before starting the app:

```dotenv
DEEPGRAM_API_KEY=your_actual_deepgram_api_key
MISTRAL_API_KEY=your_actual_mistral_api_key
MISTRAL_MODEL=voxtral-small-2507
```

The first two values are required. `MISTRAL_MODEL` is optional; leave the example value or omit that line to use the default. The app and comparison script load `.env` automatically, and Git ignores it. Do not add quotes or spaces around the `=` signs.

The first run may download an FFmpeg executable through `imageio-ffmpeg`. Upload an English recording with one speaker. For recordings longer than one minute, the app sends the centered one-minute excerpt to Deepgram and Mistral; shorter recordings are reviewed in full. Timestamps refer to the selected excerpt. The app keeps the current review in Streamlit session memory and does not save recordings locally. `MISTRAL_MODEL` can override the default `voxtral-small-2507`.

The app shows the model's JSON review directly. It asks for feedback on each foundation and for timed transcript references, but does not validate the model's claims or references. Numeric support comes from local measurements in the prompt; absolute microphone level is not room loudness. Tonality is a tentative description of heard expression, not a claim about the speaker's actual emotional state. Check model feedback against the recording before relying on it.

Mistral requests retry briefly when the API returns a transient rate limit. If reviews continue to return 429, check your account's [API limits and workspace spending cap](https://docs.mistral.ai/admin/billing-usage/usage-limits). A workspace that has exhausted its monthly cap will keep returning 429 until its limit or billing period changes.

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)
- [Reproducible local research probe](scripts/research_probe.py)
- [Pilot protocol and current status](docs/evaluation/pilot.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
