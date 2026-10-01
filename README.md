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

Use Node 22.18+ and pnpm 11.10+. Copy `.env.example` to `.env` and set `DEEPGRAM_API_KEY` and `OPENAI_API_KEY` for live reviews. The API keys stay on the backend.

```sh
pnpm install
pnpm dev             # web: http://localhost:5173, API: http://localhost:8000
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The Vite server proxies `/api` to the backend. The page's sample take was voiced with macOS `say`; its review in `apps/webapp/src/lib/sample.ts` is written by hand and labeled as a sample. A live upload is transcribed with Deepgram, measured by the rate package, and reviewed in context with OpenAI. The backend returns the original audio, timed segments, and rate findings to the editor. Other foundations are marked uncertain.

Web routes use flat folders in `apps/webapp/src/routes`, matching `../leksoro`: each route has a `route.tsx` entry, with dots in folder names for nested paths. Pathless `_public` and `_protected` layouts follow `../branchwren`: `_public.index` (`/`) and `_public.components` (`/components`) share the site header, while `_protected.upload` (`/upload`) starts a recording review without it. The protected group is a layout boundary; authentication is not implemented yet. Vite generates `src/routeTree.gen.ts` on dev/build; commit that file but do not edit it by hand.

## Rate of speech

Rate review measures the audio before asking the model to interpret a passage. It no longer labels words as important/unimportant to decide where to slow down. The existing transcript highlights remain the output; there is no new report layout.

- FFmpeg decodes uploads, measured silence separates speaking pace from articulation speed, and forced alignment refines word boundaries. Alignment downloads a checksum-verified 95 MB English model on first use. `ALIGN_WORDS=0` disables it for live uploads; failed alignment falls back to recognizer timing.
- A six-second rolling WPM curve separates speaking pace (including silence) from articulation pace (excluding silence). Measured pauses are separate intervals; the articulation line has gaps during silence. This is descriptive evidence, not a pause-foundation score.
- Commas and full stops suggest clause boundaries; ellipses can indicate unfinished thoughts. Acoustic interruptions stay inside a clause instead of breaking it into apparently fluent fragments. ASR punctuation is fallible and the context reviewer checks the actual meaning.
- Dictionary syllables help compare different words. Local fast/slow candidates compare clause articulation with the preceding clauses and require a sustained change; a brief isolated emphasis is insufficient. Future acceleration cannot retroactively make earlier delivery “too slow.” Absolute extremes remain detectable too. Repeated internal interruptions can nominate connected-delivery feedback even when the words themselves are spoken at a normal speed.
- Even-pace candidates compare shorter word groups (including gaps) with syllable-based phrase rates, while the full clause profile supplies context. Clear breaks after completed sentences count as rhythmic framing; stable articulation alone is insufficient to call that delivery monotonous. This catches regular cadence without treating all silence as an automatic exemption or averaging away local contrast.
- Sustained absolute patterns produce tentative, descriptive coaching observations directly from the measurements. The language model cannot erase or crop their evidence. The context reviewer handles broader local speed changes and interrupted thoughts, using the complete transcript plus nearby clauses and pauses. It can keep, dismiss or abstain, but must preserve each measured span. No reference-speaker identity enters the detector.
- Accepted findings retain exact word highlights. Inadequate timing, unsupported text, or a failed review produces an uncertain assessment. Other speech fundamentals remain unanalyzed.

These are English development heuristics, not a measure of comprehension or a model trained to imitate Vinh. Syllable normalization reduces word-length effects but does not model every phoneme or accent. The deterministic absolute-pattern policy trades contextual flexibility for reproducible observations: an intentionally fast performance or an unbroken list can still warrant no correction despite triggering a pattern. Fixed thresholds need validation with other speakers; repeated fast/slow cadence currently has synthetic tests but no real positive example in this corpus.

## Rate benchmark and annotation

The active rate corpus contains **22 excerpts**: the 17 Vinh controls (13 clean and four deliberate mistakes), plus five excerpts from the uploaded selection-bias recording (two interrupted-flow corrections and three clean rate controls). The practice annotations were chosen from transcript/acoustic inspection before the revised detector was evaluated. They are provisional, not independent listener judgments. Student readings and unrelated course demonstrations are excluded. Original recordings are preserved.

`benchmarks/rate-development.json` contains source hashes, cut boundaries, excluded ranges and the expected mistake spans. These annotations come from lesson demonstrations and transcript/acoustic curation, not an independent listening study. Source audio hashes and annotation notes make their provenance explicit. The importer writes playable WAVs, word-aligned golden marks, and the complete source transcript alongside each excerpt so context is preserved. Import refuses to overwrite existing annotations.

```sh
pnpm import:rate --videos-dir /path/to/videos --speech-dir /path/to/practice-sources --ffmpeg /path/to/ffmpeg
# Optional: --transcripts-dir /path/to/cache reuses <video stem>.deepgram.json.
# The practice source directory holds selection-bias.m4a and selection-bias.deepgram.json.
pnpm markup-tools           # http://localhost:8765
pnpm eval:rate --require-pass
pnpm eval:rate --label-run repeat-1 --require-pass
pnpm eval:rate vinh_demo-01 vinh_rate-01
```

In the annotator, play a take and select transcript words to adjust its golden marks. An empty reviewed annotation explicitly means no rate problem. Pipeline predictions are a separate, initially hidden overlay. Enable **Pipeline** and open **Pace trace** to inspect the WPM curves and silence bands; click the graph to seek. The upload UI retains passage highlights. Its API response also carries `rateDiagnostics` with the measurements, candidates and contextual decisions for debugging. Gold is never generated from predictions or sent to the context model.

The report is `recordings-rate-development/rate-benchmark.json`. `--require-pass` requires every selected take to be reviewed and scored, no uncertain/error results, no missed mistakes and no false alarms. Matching requires the same rate rule and word intersection-over-union ≥ 0.3, with one-to-one matching. This prevents either duplicate predictions or returning no findings everywhere from passing the full corpus.

Version 16 passed three fresh context-review runs on this 22-clip development set: each found all six annotated corrections, with no false alarms on the 16 clean takes and no uncertain/error results. The full uploaded recording also retained the interrupted thoughts at 0:41–0:48 and 2:33–2:38 in a replay with the original alignment. Reports for the default run and `repeat-1`/`repeat-2` are kept in the local corpus directory.

Rule IDs preserve compatibility with saved highlights: `RATE_IMPORTANCE_FAST` means rushed delivery, `RATE_IMPORTANCE_SLOW` means dragged delivery, `RATE_VARIATION` means sustained even pace, `RATE_REPETITIVE` means repeated fast/slow cadence, and `RATE_FLOW` means repeated interruptions within an unfinished thought. Flow advice asks for connected delivery rather than faster articulation or a pause-placement correction. The first two names no longer imply an importance label.

Evaluation uses forced alignment by default; `--recognizer-timing` is an explicit ablation. Context reviews are cached by audio hash, full request, model, effort, rate version and run label. `--label-run` creates an independent review run; `--fresh` replaces the selected run's responses. `RATE_MODEL` overrides the model for both evaluation and live reviews; otherwise `IMPORTANCE_MODEL` (default `gpt-6-sol`) applies. `IMPORTANCE_EFFORT` defaults to `low`.

This is a two-speaker **development benchmark**, used during tuning. Clips from the same recording are correlated and do not count as independent speakers. Passing it does not establish accuracy on unfamiliar speakers. The ordinary-speech positives currently cover interrupted flow, not a broad range of rushed or monotonous delivery. Check repeat runs and the full recording, not only the cropped passages.

Audio, transcripts, annotations, caches and reports stay local and gitignored. `--recordings-dir` selects another evaluation corpus; `RECORDINGS_DIR` selects another annotator corpus. The historical voice-pack importer and annotations remain available for other foundations, but are not the active rate benchmark.

```sh
pnpm --dir packages/vocal-processing rate ../../recordings-rate-development/rate/vinh_demo-01/vinh_demo-01.wav
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
