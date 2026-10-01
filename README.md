# MicMane

Speech coaching for the five foundations taught in `videos/`: rate, volume, pitch/melody, tonality, and pauses. The live review currently evaluates **rate of speech**. The other foundations are shown in the hand-written sample review, but are not yet analyzed for uploaded takes.

## Workspace

This is a pnpm and Turborepo workspace modeled on the layout of `../leksoro`:

- `apps/webapp` — React, Vite, TanStack Router, and the sample take/editor.
- `apps/backend` — Fastify `/api/review` and `/api/health`.
- `apps/markup-tools` — local golden-set annotator.
- `packages/ui` — reusable components, `cn`, and the single shared Tailwind stylesheet used by the web app.
- `packages/vocal-processing` — transcription, message labeling, rate detection, evaluation scripts, and tests.
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

The Vite server proxies `/api` to the backend. The page's sample take was voiced with macOS `say`; its review in `apps/webapp/src/lib/sample.ts` is written by hand and labeled as a sample. A live upload is transcribed with Deepgram, labeled with OpenAI, and analyzed by the rate package. The backend returns the original audio, timed segments, and rate findings to the editor. Other foundations are marked uncertain.

Web routes use flat folders in `apps/webapp/src/routes`, matching `../leksoro`: each route has a `route.tsx` entry, with dots in folder names for nested paths. Pathless `_public` and `_protected` layouts follow `../branchwren`: `_public.index` (`/`) and `_public.components` (`/components`) share the site header, while `_protected.upload` (`/upload`) starts a recording review without it. The protected group is a layout boundary; authentication is not implemented yet. Vite generates `src/routeTree.gen.ts` on dev/build; commit that file but do not edit it by hand.

## Voice-pack annotation and benchmarking

Run `pnpm markup-tools` and open http://localhost:8765. The active corpus is the October 1 voice pack: **14 separate paragraph takes**, grouped in `recordings/rate/`, `pauses/`, `volume/`, `tonality/`, and `pitch_melody/`. Recordings 36–40 map to those foundations in that order, as confirmed by the speaker. Each folder retains its original source recording and transcript under `source/`.

1. Choose a take, play it, and select transcript words to mark mistakes. Tabs choose the foundation being annotated. Use the recording selector or previous/next arrows to move between takes.
2. Marks autosave alongside the existing notes and review metadata. The review-controls section has been removed; editing a mark preserves its existing review status. Listening volume changes playback only, and pipeline predictions start hidden.
3. Run `pnpm eval:rate` to evaluate rate-reviewed takes, or `pnpm eval:rate rate-01 rate-02` for selected takes. `pnpm eval:rate --predict-only` generates predictions without scoring or changing review status. Reload the annotator to see them.

Your selected good references are take 3 for rate, pauses, volume and pitch/melody, and take 2 for tonality. After your corrections and confirmation, all 14 takes are reviewed for their respective foundations. A reviewed take with no marks is an explicit good example for that foundation; other foundations are not implicitly reviewed. Pending and excluded annotations still do not affect scores. Review notes and comparison notes remain saved in the annotation JSON.

The draft recipe is `benchmarks/voice-pack-20261001.markup.json`. After a fresh import, restore this starting point with `node packages/vocal-processing/scripts/seed-reference-markup.ts` from the repository root. It saves a backup under `recordings/.annotation-history/` and refuses to replace existing marks or notes with differing seed data. Later human edits remain the source of truth.

The report is `recordings/rate-benchmark.json`, with per-take and per-rule counts, precision/recall/F1, and false alarms on reviewed good examples. Matching requires the same rule and word intersection-over-union ≥ 0.3, with one-to-one matching so duplicate predictions cannot inflate hits. The only rate rules are `RATE_IMPORTANCE_FAST` (slow down on these words) and `RATE_IMPORTANCE_SLOW` (speed up through these words). Each phrase adjustment is scored directly. Low pace variation may help the detector choose a pair of phrases, but is never a standalone finding. There is no old retake comparison or within-recording train/test split. With no reviewed takes, the command writes coverage information, reports no score, exits nonzero and makes no model calls.

This is a single-speaker development benchmark using one repeated paragraph. It is not an independent test set. The rate detector's existing thresholds remain unchanged until annotation supplies a new target; its internal low-variation comparison still requires a 20-second stretch, while phrase-level rushed/dragging checks also work on short takes. The reference drafts identify specific phrase adjustments regardless of that internal threshold. The report records this limitation. Model labels are cached by transcript, strategy, model, effort and prompt version; annotations and take identity are never model inputs. Use `--fresh` to relabel.

### Reimporting the pack

```sh
pnpm import:voice-pack --archive /path/to/drive-download-20261001T103829Z-1-001.zip
# Add --ffmpeg /path/to/ffmpeg if it is not on PATH.
# Add --replace to move an existing corpus to a sibling archive before importing.
```

Import requires FFmpeg and `unzip`, plus `DEEPGRAM_API_KEY` in `.env`. `--transcripts-dir /path/to/cache` can reuse `<source filename>.json` Deepgram responses instead. The checked-in recipe, `benchmarks/voice-pack-20261001.json`, contains source hashes and verified boundaries between complete readings. Cuts fall in the quiet gaps; all source audio is retained, including the long pauses inside Recording 37. PCM WAV takes preserve level and pitch without normalization. Source word timestamps are rebased to each take, and transcripts remain the recognizer's output rather than being silently replaced by the reference paragraph. In particular, check “Do you have” in tonality take 1 and “A few” in volume take 3 against playback before reviewing. Notes can flag a transcript problem; exclude a take until its timed transcript is corrected if needed.

Audio, transcripts, annotations, caches, and generated reports remain local and gitignored. The importer stages and validates the whole corpus before replacing it. `--replace` starts fresh pending annotations; it does not migrate prior marks. In linked worktrees, point `recordings/` at the shared local corpus or set `RECORDINGS_DIR` for the annotator and `--recordings-dir` for evaluation. The importer resolves a recordings symlink to its real destination.

## Vocal processing

The first stage labels transcript phrases by message importance. The rate stage identifies specific phrases to slow down or speed up; live reviews quote those words and preserve their exact highlight boundaries. Live processing needs the API keys in `.env`; tests need neither.

```sh
pnpm --dir packages/vocal-processing rate ../../recordings/rate/rate-01/rate-01.wav
pnpm --dir packages/vocal-processing test
python3 -m unittest discover -s apps/markup-tools -p 'test_*.py'
```

Script paths are relative to `packages/vocal-processing`, including paths passed through the root `pnpm rate` command. Importance evaluation now also uses reviewed marks from this corpus.

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
