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

Use Node 22.18+ and pnpm 11.10+. Copy `.env.example` to `.env` and set `DEEPGRAM_API_KEY` for live reviews. The key stays on the backend.

```sh
pnpm install
pnpm dev             # web: http://localhost:5173, API: http://localhost:8000
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The Vite server proxies `/api` to the backend. The page's sample take was voiced with macOS `say`; its review in `apps/webapp/src/lib/sample.ts` is written by hand and labeled as a sample. A live upload is transcribed with Deepgram and measured by the rate package; no language model is involved. The backend returns the original audio, timed segments, and rate findings to the editor. Other foundations are marked uncertain.

Web routes use flat folders in `apps/webapp/src/routes`, matching `../leksoro`: each route has a `route.tsx` entry, with dots in folder names for nested paths. Pathless `_public` and `_protected` layouts follow `../branchwren`: `_public.index` (`/`) and `_public.components` (`/components`) share the site header, while `_protected.upload` (`/upload`) starts a recording review without it. The protected group is a layout boundary; authentication is not implemented yet. Vite generates `src/routeTree.gen.ts` on dev/build; commit that file but do not edit it by hand.

## Rate of speech

Rate is how fast the words themselves are spoken: **articulation rate**, syllables per second of actual speaking, with pauses left out. Listeners judge speed mostly from articulation rather than from pausing ([Grosjean & Lane](https://francoisgrosjean.ch/perc_comp/13.%20Grosjean%20&%20Lane.pdf)), and pausing is a separate fundamental, so no pause decides a rate finding. Detection is deterministic: there is no language-model step.

- FFmpeg decodes uploads, measured silence separates speaking from pausing, and forced alignment refines word boundaries. Alignment downloads a checksum-verified 95 MB English model on first use. `ALIGN_WORDS=0` disables it for live uploads; failed alignment falls back to recognizer timing. Without decodable audio the review is uncertain.
- A shared English pronunciation counter turns words into syllables, expanding numbers and estimating unknown words, so long and short words compare fairly.
- `rate.ts` flags two everyday problems, each sustained across **15 s of speaking**, or the whole clip when it has less. Short bursts are ordinary, even for professional speakers.
  - **Rushed:** at least 8 syllables/s.
  - **Dragging:** at most 3 syllables/s.
- Fewer than 5 s of speech, mostly unknown words, or implausible timing gives an uncertain assessment rather than a clean one. A word is never credited with more than 1 s per syllable, so music or noise absorbed into its timing doesn't count as slow speech.
- The annotator's pace trace shows a six-second rolling rate with and without silence. It is descriptive only.

These four values are the whole configuration (`DEFAULT_RATE_CONFIG`). They are round numbers outside everyday speech, checked on recordings that played no part in choosing them: about three hours from four speakers (Vinh's Volume, Pitch and Tonality lessons, 22 of your own talks and the voice pack, and the course student). Sustained articulation there stayed between 3.3 and 7.0 syllables/s; the published mean for spontaneous American English is about 5.1. On 323 random 30 s, 60 s and 2-minute clips from that set, nothing was flagged. With the same clips sped up uniformly, 1.6× was flagged in 75–100% of clips and 1.3× rarely. Slowed to 0.55×, they were flagged in 95–100%. Only clearly fast or slow speech is reported.

Version 19 narrowed rate to speed. Monotonous delivery and broken-up thoughts were detected from missing or extra pauses, so they now belong to the pause fundamental. Their benchmark annotations moved there unchanged, apart from the foundation and rule. Speed variation alone does not separate good from monotonous delivery: Vinh's and your everyday speech often varies less than his monotone demonstrations; what marks those demonstrations is that he never pauses. Rate also no longer judges speed changes around a specific point; that needs annotated examples first. The removed rules, the contextual review and the OpenAI adapter are in the history at `e016ffc`.

These are English development heuristics, not a measure of comprehension or a model trained to imitate Vinh. Syllable normalization reduces word-length effects but does not model every phoneme or accent.

## Rate benchmark and annotation

The rate corpus contains **22 excerpts**: 17 from Vinh (13 clean and four deliberate mistakes) and five from the uploaded selection-bias recording. Two excerpts are excluded from rate because they hold less than 5 s of speech: the slow-greeting demonstration and one practice clip. That leaves one rate correction (the rushed greeting) and 19 clean takes. The other three demonstrations and two practice corrections are now pause annotations, awaiting a pause benchmark. The annotations are provisional transcript/acoustic judgments, not independent listener ratings.

`benchmarks/rate-development.json` contains source hashes, cut boundaries, excluded ranges, each take's rate status and the expected mistake spans with their foundation. The importer writes playable WAVs, word-aligned golden marks, and the complete source transcript alongside each excerpt. Import refuses to overwrite existing annotations.

```sh
pnpm import:rate --videos-dir /path/to/videos --speech-dir /path/to/practice-sources --ffmpeg /path/to/ffmpeg
# Optional: --transcripts-dir /path/to/cache reuses <video stem>.deepgram.json.
# The practice source directory holds selection-bias.m4a and selection-bias.deepgram.json.
pnpm markup-tools           # http://localhost:8765
pnpm eval:rate --require-pass
pnpm eval:rate vinh_demo-02 vinh_rate-01
```

In the annotator, play a take and select transcript words to adjust its golden marks. An empty reviewed annotation explicitly means no rate problem. Pipeline predictions are a separate, initially hidden overlay. Enable **Pipeline** and open **Pace trace** to inspect the syllables-per-second curves and silence bands; click the graph to seek. The upload API response also carries `rateDiagnostics` with the measurements for debugging. Gold is never generated from predictions.

The report is `recordings-rate-development/rate-benchmark.json`. `--require-pass` requires every take that isn't excluded to be reviewed and scored, with no uncertain or error results, no missed mistakes and no false alarms. Matching requires the same rate rule and word intersection-over-union ≥ 0.3, with one-to-one matching. Version 19 passes: the rushed greeting is found and none of the 19 clean takes is flagged. Evaluation uses forced alignment by default; `--recognizer-timing` is an explicit ablation.

Rule IDs preserve compatibility with saved highlights: `RATE_IMPORTANCE_FAST` means rushed delivery and `RATE_IMPORTANCE_SLOW` means dragged delivery. The names no longer imply an importance label.

One positive example cannot establish accuracy, which is why the held-out clips above matter more than this gate. A real rushed or dragging take from someone other than Vinh would be the most valuable addition.

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
