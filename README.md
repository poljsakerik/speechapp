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

Run the annotator separately with `pnpm markup-tools` at `http://localhost:8765`. It reads and writes local files in `recordings/`.

## Vocal processing

The first stage, `importance.ts`, splits transcript words into phrases and labels their importance. Its message-first mode identifies the speaker's point before assigning labels. The rate stage flags only substantial issues: monotonous stretches, rushed message phrases, and dragged unimportant phrases. Thresholds live in `RateConfig` and are calibrated on the recording-03 re-record.

```sh
pnpm --dir packages/vocal-processing importance ../../recordings/recording-03-pauses/recording-03-pauses.json
pnpm --dir packages/vocal-processing rate ../../recordings/recording-03/recording-03.m4a
pnpm --dir packages/vocal-processing eval:rate recording-03
```

Paths for the scripts above are relative to `packages/vocal-processing`. Live processing needs both API keys in `.env`. Tests need neither.

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
