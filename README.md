# MicMane

Speech coaching for the five foundations taught in `videos/`: rate, volume, pitch/melody, tonality, and pauses.

## MicMane web app

The public page and component showcase live in `web/` (React, Vite, restyled shadcn/ui). The free review on the page posts to `/api`, which has no backend yet.

```sh
cd web && npm install && npm run dev       # http://localhost:5173, /components for the showcase
```

The dev server proxies `/api` to port 8000. The page's sample take was voiced with macOS `say`; its review is written by hand in `web/src/lib/sample.ts` and labeled as a sample on the page.

## Processing pipeline

`pipeline/` (Node 22.18+, no dependencies) processes transcript words. Its first stage, `src/importance.ts`, has an OpenAI model (`gpt-6-sol` at low reasoning effort by default) split the transcript into phrases and label each word important, unimportant or filler. The rate-of-speech checks will compare pace against these labels.

```sh
cd pipeline && npm test
npm run importance -- ../recordings/recording-03-pauses/recording-03-pauses.json   # needs OPENAI_API_KEY in .env
npm run eval:importance -- gpt-6-luna:low gpt-6-sol:low gpt-6-sol:medium         # score models against the golden set
```

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
