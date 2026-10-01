# MicMane

Speech coaching for the five foundations taught in `videos/`: rate, volume, pitch/melody, tonality, and pauses. The live review evaluates **rate of speech and pauses**, including replacing fillers with silence. The other foundations are shown in the hand-written sample review, but are not yet analyzed for uploaded takes.

## Workspace

This is a pnpm and Turborepo workspace modeled on the layout of `../leksoro`:

- `apps/webapp` — React, Vite, TanStack Router, and the sample take/editor.
- `apps/backend` — Fastify `/api/review` and `/api/health`.
- `apps/markup-tools` — local golden-set annotator.
- `packages/ui` — reusable components, `cn`, and the single shared Tailwind stylesheet used by the web app.
- `packages/vocal-processing` — transcription, shared message/pause labeling, rate and pause detection, evaluation scripts, and tests.
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

The Vite server proxies `/api` to the backend. The page's sample take was voiced with macOS `say`; its review in `apps/webapp/src/lib/sample.ts` is written by hand and labeled as a sample. A live upload is transcribed with Deepgram and labeled with OpenAI. Rate and pause analysis share those labels and original word timings. The backend returns the original audio, timed segments, estimated gaps, and up to three priority coaching notes with exact pins and word spans. Related findings can share a note while retaining their rule IDs. Other foundations are marked uncertain.

Web routes use flat folders in `apps/webapp/src/routes`, matching `../leksoro`: each route has a `route.tsx` entry, with dots in folder names for nested paths. Pathless `_public` and `_protected` layouts follow `../branchwren`: `_public.index` (`/`) and `_public.components` (`/components`) share the site header, while `_protected.upload` (`/upload`) starts a recording review without it. The protected group is a layout boundary; authentication is not implemented yet. Vite generates `src/routeTree.gen.ts` on dev/build; commit that file but do not edit it by hand.

Run the annotator separately with `pnpm markup-tools` at `http://localhost:8765`. It reads and writes local files in `recordings/`.

## Vocal processing

The first stage, `importance.ts`, splits transcript words into phrases and labels their importance. Its message-first mode identifies the speaker's point before assigning labels. The rate stage flags only substantial issues: monotonous stretches, rushed message phrases, and dragged unimportant phrases. Thresholds live in `RateConfig` and are calibrated on the recording-03 re-record.

```sh
pnpm --dir packages/vocal-processing importance ../../recordings/recording-03-pauses/recording-03-pauses.json
pnpm --dir packages/vocal-processing rate ../../recordings/recording-03/recording-03.m4a
pnpm --dir packages/vocal-processing eval:rate recording-03
pnpm --dir packages/vocal-processing analyze ../../recordings/recording-27/recording-27.json
pnpm --dir packages/vocal-processing eval:pauses recording-03 recording-27
```

Paths for the scripts above are relative to `packages/vocal-processing`. Live processing needs both API keys in `.env`. Tests need neither.

Pause analysis uses the existing golden rules: `PAUSE_NECESSARY`, `PAUSE_UNNECESSARY`, and `PAUSE_FILLERS`. The shared labeling request identifies contextual boundaries; deterministic rules compare these with estimated gaps. Fillers and false starts remain separate from silence, including in the rate analyzer. Ambiguous or dramatic readings are left alone. Defaults are configurable starting heuristics, not thresholds fitted to recording-03. See [pause analysis and evaluation](docs/pause-analysis.md) for limitations and evaluation results.

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
