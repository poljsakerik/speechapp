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

`src/importance.ts` also has a message-first mode, `markMessage`. The model first says what the speaker is trying to get across, then labels the few words that carry that message `message`, other words worth stressing (punchlines, key facts) `important`, and the rest `unimportant` or `filler`.

The second stage, `src/rate.ts`, looks at whether pace varies and marks only the few places that get in the way, leaving out filler words and the time they take:

- `RATE_MONOTONE`: a stretch where pace barely changes, with a message phrase to slow down on and an unimportant one to speed up through.
- `RATE_IMPORTANCE_FAST`: a message phrase said at normal pace or faster, with no pause around it and no slowing relative to its surroundings.
- `RATE_IMPORTANCE_SLOW`: an unimportant phrase dragged far past normal pace.

Marks are ranked by impact, the seconds a fix would add or save; small ones are dropped, and at most about one mark per minute is kept. Every threshold is in `RateConfig` (`DEFAULT_RATE_CONFIG`). The defaults are calibrated on the one good delivery, the recording-03 re-record, which gets no marks. The other recordings are practice takes and don't define normal.

```sh
npm run rate -- ../recordings/recording-03/recording-03.m4a   # audio → Deepgram → importance → rate marks; needs DEEPGRAM_API_KEY too
npm run eval:rate -- recording-03 [--strategy importance]    # compare with the golden marks and the good retake
```

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
