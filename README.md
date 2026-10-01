# MicMane

Speech coaching for the five foundations taught in `videos/`: rate, volume, pitch/melody, tonality, and pauses. The live review currently evaluates **rate of speech**. The other foundations are shown in the hand-written sample review, but are not yet analyzed for uploaded takes.

## Workspace

This is a pnpm and Turborepo workspace modeled on the layout of `../leksoro`:

- `apps/webapp` — React, Vite, TanStack Router, and the sample take/editor.
- `apps/backend` — Fastify `/api/review` and `/api/health`.
- `apps/markup-tools` — local golden-set annotator.
- `packages/ui` — reusable components, `cn`, and the single shared Tailwind stylesheet used by the web app.
- `packages/vocal-processing` — transcription, alignment, rate detection, evaluation scripts, and tests.
- `packages/config-typescript` and `packages/config-eslint` — shared compiler and ESLint flat configs.

Use Node 22.18+ and pnpm 11.10+. Copy `.env.example` to `.env` and set `DEEPGRAM_API_KEY` and `OPENAI_API_KEY` for live reviews. The keys stay on the backend.

```sh
pnpm install
pnpm dev             # web: http://localhost:5173, API: http://localhost:8000
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The Vite server proxies `/api` to the backend. The page's sample take was voiced with macOS `say`; its review in `apps/webapp/src/lib/sample.ts` is written by hand and labeled as a sample. A live upload is transcribed with Deepgram, its text is given a pacing prediction by OpenAI, and the rate package measures the audio against it. The backend returns the original audio, timed segments, and rate findings to the editor. Other foundations are marked uncertain.

Web routes use flat folders in `apps/webapp/src/routes`, matching `../leksoro`: each route has a `route.tsx` entry, with dots in folder names for nested paths. Pathless `_public` and `_protected` layouts follow `../branchwren`: `_public.index` (`/`) and `_public.components` (`/components`) share the site header, while `_protected.upload` (`/upload`) starts a recording review without it. The protected group is a layout boundary; authentication is not implemented yet. Vite generates `src/routeTree.gen.ts` on dev/build; commit that file but do not edit it by hand.

## Rate of speech

The aim is to show an untrained speaker where someone of the course coach's caliber would slow down or move through. Rate is how fast the words themselves are spoken: **articulation rate**, speech per second of actual speaking, with pauses left out. Listeners judge speed mostly from articulation rather than from pausing ([Grosjean & Lane](https://francoisgrosjean.ch/perc_comp/13.%20Grosjean%20&%20Lane.pdf)). Pausing is reviewed elsewhere.

- FFmpeg decodes uploads, measured silence separates speaking from pausing, and forced alignment refines word boundaries. Alignment downloads a checksum-verified 95 MB English model on first use. `ALIGN_WORDS=0` disables it for live uploads; failed alignment falls back to recognizer timing.
- **Pacing prediction** (`pacing.ts`). The transcript is split into short phrases from the text alone. A language model scores each from −2 (a skilled speaker would slow down: the point, a key term, a contrast, a number) to +2 (move through: setup, asides, restatements). It sees only the words, never the audio. Long talks are scored in chunks of 120 phrases with the neighbouring text as context. `RATE_MODEL` (default `gpt-6-sol`) and `RATE_EFFORT` (default `low`) choose the model.
- **Contrast** (`rate.ts`, the everyday finding). Each phrase's pace, in phones per second of speaking, is compared with the speaker's own median phrase, so it works for fast and slow talkers alike. Over a passage of 12 phrases (about 30 s), the key phrases should be slower than the setup phrases. When they weren't at all, the passage is flagged with one phrase to slow down on and one to move through. Single phrases are too noisy to judge; passages are not.
- **Sustained speed** (the obvious cases). 15 s of speaking, or the whole clip, at 8 syllables/s or more, or 3 or less, is flagged as rushed or dragging. A word is never credited with more than 1 s per syllable, so music or noise absorbed into its timing doesn't count as slow speech.
- Fewer than 5 s of speech, mostly unknown words, implausible timing, undecodable audio or a failed prediction gives an uncertain assessment rather than a clean one.

### How well it matches skilled delivery

Speech allows several valid interpretations, so the goal is partial agreement with skilled delivery, not a perfect score. A perfect benchmark result would suggest overfitting. `scripts/eval-pacing.ts` measures two things per group of recordings:
- **Agreement:** the rank correlation between predicted scores and actual phrase pace.
- **Flagged:** the share of passages the contrast check flags.

On recordings that played no part in designing the check:

| Group | Agreement | Passages flagged |
|---|---|---|
| Course coach, 13 benchmark clips (8 min) | +0.16 to +0.24 | 7–21% |
| Course coach, three other lessons (18 min) | +0.17 | 29–31% |
| 21 untrained practice talks (126 min) | −0.05 to −0.01 | 45–53% |
| A good retake of one talk | −0.03 to +0.08 | 0–17% |
| The original, poorer take of that talk | −0.10 to −0.12 | 86–100% |

Ranges span `gpt-6-sol` and `gpt-6-luna`. The coach's pace follows the prediction and untrained talks don't, and the check flags him far less often. Fresh predictions from the same model agree at a correlation of 0.92. Simple text features (function words, phrase length, position) explain only 1% of the coach's pace changes, so the prediction captures meaning rather than word sounds.

The prompt is unchanged from its first version, and the passage length gives the same picture at 8, 12 or 20 phrases. The development set is two speakers plus one learner, so more speakers would make the comparison stronger. These are English heuristics, not a measure of comprehension or a model trained to imitate one speaker.

## Rate benchmark and annotation

The development corpus contains **22 excerpts**: 17 from Vinh (13 clean and four deliberate mistakes) and five from the uploaded selection-bias recording. Four excerpts are excluded from rate. The slow-greeting demonstration and one practice clip hold less than 5 s of speech. The two constant-pace demonstrations show a lack of variation, which the speed checks don't judge. That leaves one rate correction (the rushed greeting) and 17 clean takes. The annotations are provisional transcript/acoustic judgments, not independent listener ratings.

`benchmarks/rate-development.json` contains source hashes, cut boundaries, excluded ranges, each take's rate status and the expected mistake spans. The importer writes playable WAVs, word-aligned golden marks, and the complete source transcript alongside each excerpt. Import refuses to overwrite existing annotations.

```sh
pnpm import:rate --videos-dir /path/to/videos --speech-dir /path/to/practice-sources --ffmpeg /path/to/ffmpeg
# Optional: --transcripts-dir /path/to/cache reuses <video stem>.deepgram.json.
# The practice source directory holds selection-bias.m4a and selection-bias.deepgram.json.
pnpm markup-tools           # http://localhost:8765
pnpm eval:rate --require-pass
pnpm eval:rate vinh_demo-02 vinh_rate-01
```

In the annotator, play a take and select transcript words to adjust its golden marks. An empty reviewed annotation explicitly means no rate problem. Pipeline predictions are a separate, initially hidden overlay. Enable **Pipeline** and open **Pace trace** to inspect the syllables-per-second curves and silence bands; click the graph to seek. The upload API response also carries `rateDiagnostics` with the measurements for debugging. Gold is never generated from predictions.

The report is `recordings-rate-development/rate-benchmark.json`. The gold marks cover the obvious sustained-speed mistakes, and only those are gated. `--require-pass` requires every take that isn't excluded to be reviewed and scored, with no uncertain or error results, no missed mistakes and no false alarms. Matching requires the same rate rule and word intersection-over-union ≥ 0.3, with one-to-one matching. The contrast check is reported per group but not gated. Most excerpts are too short for a 30 s passage; use `eval-pacing` on full recordings instead. Evaluation uses forced alignment by default; `--recognizer-timing` is an explicit ablation and `--no-pacing` skips the prediction. Model replies are cached by request, model, effort and pacing version.

Rule IDs preserve compatibility with saved highlights: `RATE_IMPORTANCE_FAST` means rushed delivery and `RATE_IMPORTANCE_SLOW` means dragged delivery. The names no longer imply an importance label.

```sh
pnpm --dir packages/vocal-processing exec node --env-file=../../.env scripts/eval-pacing.ts /path/to/recordings.json
# recordings.json lists { name, group, audio, transcript }: a PCM WAV and its Deepgram JSON, relative to the file.
```

Audio, transcripts, annotations, caches and reports stay local and gitignored. `--recordings-dir` selects another evaluation corpus; `RECORDINGS_DIR` selects another annotator corpus. The historical voice-pack importer and annotations remain available for other foundations, but are not the active rate benchmark.

```sh
pnpm --dir packages/vocal-processing rate ../../recordings-rate-development/rate/vinh_demo-02/vinh_demo-02.wav
pnpm --dir packages/vocal-processing test
python3 -m unittest discover -s apps/markup-tools -p 'test_*.py'
```

CLI file paths are relative to `packages/vocal-processing`, including arguments passed through root package scripts. The rate CLI accepts PCM WAV; live uploads use FFmpeg to decode the supported upload formats.

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
