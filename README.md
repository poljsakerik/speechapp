# MicMane

Speech coaching for the five foundations taught in `videos/`: rate, volume, pitch/melody, tonality, and pauses. The live review evaluates all five for uploaded takes: **rate of speech**, **pauses**, **volume**, **tonality** and **pitch & melody**. Besides what to improve, it points out what the speaker does sincerely well on rate, pauses, tonality and pitch ([strengths](#strengths)). The landing page shows a hand-written sample review.

## Workspace

This is a pnpm and Turborepo workspace modeled on the layout of `../leksoro`:

- `apps/webapp` — React, Vite, TanStack Router, and the sample take/editor.
- `apps/backend` — Fastify serving a tRPC router at `/trpc` (`review.create`, `health.get`).
- `apps/markup-tools` — local golden-set annotator.
- `packages/ui` — reusable components, `cn`, and the single shared Tailwind stylesheet used by the web app.
- `packages/vocal-processing` — transcription, alignment, rate detection, evaluation scripts, and tests.
- `packages/config-typescript` and `packages/config-eslint` — shared compiler and ESLint flat configs.

Use Node 22.18+ and pnpm 11.10+. Copy `.env.example` to `.env` and set `DEEPGRAM_API_KEY`, `OPENAI_API_KEY` and `GEMINI_API_KEY` (for tonality and pitch listening) for live reviews. The keys stay on the backend.

```sh
pnpm install
pnpm dev             # web: http://localhost:5173, API: http://localhost:8000
PORT=8100 API_PORT=8100 pnpm dev   # beside another checkout: the API on 8100, and the web server (next free port) proxying to it
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The Vite server proxies `/trpc` to the backend, where Fastify serves the tRPC router; the webapp calls it through TanStack Query. The page's sample take was voiced with macOS `say`; its review in `apps/webapp/src/lib/sample.ts` is written by hand and labeled as a sample. A live upload is transcribed with Deepgram, its text is given a pacing prediction by OpenAI, and the rate package measures the audio against it. Pauses are judged by a model from the measured silences, volume is measured from the same decoded audio, tonality sends each passage's audio to Gemini, and pitch is measured from the decoded audio, with Gemini listening for problems the measurement must confirm. The backend returns timed segments and findings; the editor draws and plays the file that was sent.

Web routes use flat folders in `apps/webapp/src/routes`, matching `../leksoro`: each route has a `route.tsx` entry, with dots in folder names for nested paths. Pathless `_public` and `_protected` layouts follow `../branchwren`: `_public.index` (`/`) and `_public.components` (`/components`) share the site header, while `_protected.upload` (`/upload`) starts a recording review without it. The protected group is a layout boundary; authentication is not implemented yet. Vite generates `src/routeTree.gen.ts` on dev/build; commit that file but do not edit it by hand.

## Rate of speech

The aim is to show an untrained speaker where someone of the course coach's caliber would slow down or move through. Rate is how fast the words themselves are spoken: **articulation rate**, speech per second of actual speaking, with pauses left out. Listeners judge speed mostly from articulation rather than from pausing ([Grosjean & Lane](https://francoisgrosjean.ch/perc_comp/13.%20Grosjean%20&%20Lane.pdf)). Pausing is reviewed elsewhere.

- FFmpeg decodes uploads, measured silence separates speaking from pausing, and forced alignment refines word boundaries. Alignment downloads a checksum-verified 95 MB English model on first use; the server loads it at startup and scores the audio while the recognizer transcribes. `ALIGN_WORDS=0` disables it for live uploads; failed alignment falls back to recognizer timing.
- **Pacing prediction** (`pacing.ts`). The transcript is split into short phrases from the text alone. A language model scores each from −2 (a skilled speaker would slow down: the point, a key term, a contrast, a number) to +2 (move through: setup, asides, restatements). It sees only the words, never the audio. Long talks are scored in chunks of 120 phrases with the neighbouring text as context. `RATE_MODEL` (default `gpt-6-sol`) and `RATE_EFFORT` (default `low`) choose the model.
- **Contrast** (`rate.ts`, the everyday finding). Each phrase's pace, in phones per second of speaking, is compared with the speaker's own median phrase, so it works for fast and slow talkers alike. Over a passage of 12 phrases (about 30 s), the key phrases should be slower than the setup phrases. When they weren't at all, the passage is flagged with one phrase to slow down on and one to move through. Single phrases are too noisy to judge; passages are not.
- **Sustained speed** (the obvious cases). 15 s of speaking, or the whole clip, at 8 syllables/s or more, or 3 or less, is flagged as rushed or dragging. A word is never credited with more than 1 s per syllable, so music or noise absorbed into its timing doesn't count as slow speech.
- Fewer than 5 s of speech, mostly unknown words, implausible timing, undecodable audio or a failed prediction gives an uncertain assessment rather than a clean one.

### How well it matches skilled delivery

Speech allows several valid interpretations, so the goal is partial agreement with skilled delivery, not a perfect score. A perfect benchmark result would suggest overfitting. `scripts/eval-pacing.ts` measures two things per group of recordings:

- **Agreement:** the rank correlation between predicted scores and actual phrase pace.
- **Flagged:** the share of passages the contrast check flags.

On recordings that played no part in designing the check:

| Group                                      | Agreement      | Passages flagged |
| ------------------------------------------ | -------------- | ---------------- |
| Course coach, 13 benchmark clips (8 min)   | +0.16 to +0.24 | 7–21%            |
| Course coach, three other lessons (18 min) | +0.17          | 29–31%           |
| 21 untrained practice talks (126 min)      | −0.05 to −0.01 | 45–53%           |
| A good retake of one talk                  | −0.03 to +0.08 | 0–17%            |
| The original, poorer take of that talk     | −0.10 to −0.12 | 86–100%          |

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

Rule IDs: `RATE_CONTRAST` marks a passage whose key points were no slower than its setup. `RATE_IMPORTANCE_FAST` and `RATE_IMPORTANCE_SLOW` mark sustained rushed or dragged delivery; they keep their names for compatibility with saved highlights, and no longer imply an importance label.

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

## Pauses

The pause review works like a speaking coach marking up a recording. Timing only _measures_: every pause the speaker made, found in the audio (`findPauses`, silences of 0.2 s or more), with its exact place and length. Recognizer timestamps alone hide about half of them. Every _decision_ is a judgment about meaning, made by a model (`RATE_MODEL`/`RATE_EFFORT`) reading the whole transcript with each real pause marked in place (`src/pause-review.ts`). No syllable count or duration decides anything.

| The model is asked                                                                     | Finding                                                                           | Instruction                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| Each pause: does it fit?                                                               | breaks a small unit (after "the", inside a name, a restart) → `PAUSE_UNNECESSARY` | **Don't stop after "…"**              |
|                                                                                        | the right place, but too brief for the moment to land → `PAUSE_TOO_SHORT`         | **Hold the pause longer after "…"** ‖ |
|                                                                                        | so long it stops sounding deliberate → `PAUSE_TOO_LONG`                           | **Shorten the pause after "…"**       |
| Each stretch said without a pause (listed with its length): did the listener need one? | → `PAUSE_NECESSARY`                                                               | **Pause after "…"** ‖                 |

- **Parts:** the take is reviewed in parts of about 120 words, cut at pauses, with the whole transcript as context in every request. One request for a whole take made the verdicts swing between runs (6 to 37 "breaks" on the same take); in parts, the bad take gets 40–45 findings per run, and a finding recurs in another run 54–79% of the time. Counts and recurrence are steadiest where the mistakes are clear (the bad take, 79%) and least steady on good speech (the retake, 9–19 findings, 55%), whose borderline findings come and go. The parts run in parallel.
- **Complete replies:** a reply must judge every pause and every stretch in its part; the pause that ends a part belongs to that part. An incomplete part is asked once more, then the review is not assessed: a skipped stretch is not evidence that it needs no pause.
- **Timing check:** a finding is dropped where the aligned and the recognizer's word timing disagree about which words a pause sits between, since the aligner occasionally moves a short word across a silence ("Here we ‖ go.").
- **Heard, not only read:** a transcript with pause lengths can't tell a pause held for effect from one spent searching for words, or a sentence that rushes on from one the voice clearly finishes. So the two commonest findings are kept only where Gemini, hearing the moment with about 6 s of lead-in, agrees (`pause-hearing.ts`): a pause that breaks a thought must sound hesitant, and a missing pause must sound like the words run on. Too short and too long stay the text model's call. Without `GEMINI_API_KEY`, or if a hearing fails, the text model's findings stand and `pauseDiagnostics.heard` is false.
- **No fallback rules:** without decodable audio, a model or a usable reply, pauses are reported as not assessed.

Results, three runs each:

| Recording                                          | Findings per run |
| -------------------------------------------------- | ---------------- |
| Selection-bias talk, bad take (4.6 min)            | 40–45            |
| Same talk, good retake (4.2 min)                   | 9–19             |
| Student Gladiator reading, before → after coaching | 4–7 → 0–2        |
| Student reading (Rate lesson), before → after      | 5–6 → 2–3        |

The coach's clean clips get about 6 findings per minute. About a third of their missing-pause points fall on sentence ends with an exact 0.00 s gap, which are likely jump cuts that removed a real pause. Edited video is not a fair "no missing pauses" reference; the unedited retake is.

Filler words and trailing off (also in the lesson) are not covered.

### Pause benchmark

`benchmarks/pause-development.json` cuts the Pause and Rate lessons into 20 takes: 14 clean (13 of the coach teaching and the student's coached Gladiator reading), five deliberate mistakes by the coach, and the student's first, uncoached Gladiator reading. Filler-word and trailing-off demonstrations are excluded with reasons.

```sh
pnpm import:pause --videos-dir /path/to/videos --transcripts-dir /path/to/cache --ffmpeg /path/to/ffmpeg
RECORDINGS_DIR=recordings-pause-development pnpm markup-tools
pnpm eval:pause --run run-1   # replies cached per take and run label
```

A demonstration can rightly get several findings (two places to pause in one run-on), so a finding is correct when it falls inside an annotated span of the same kind. Version 3 finds the annotated mistakes 6/6 in each of three runs, including the uncoached reading ("Pause after 'son,'" or "'Legion,'") and the slow greeting ("Don't stop after 'It's'"). Clean takes report findings per minute instead of pass/fail. A perfect score would be suspicious: skilled speakers hesitate too, and the lessons' edits remove real pauses.

With listening (`pnpm eval:pause --run run-1 --listen`), over the same three runs:

|                                                        | Read only           | Read and heard      |
| ------------------------------------------------------ | ------------------- | ------------------- |
| Annotated mistakes found                               | 6/6 each            | 5/6, 6/6, 5/6       |
| Findings on clean takes, per minute                    | 6.1-6.7             | 1.6-2.3             |
| Findings in flawed takes that are inside an annotation | 13/17, 15/19, 15/17 | 10/12, 14/16, 13/13 |

The two misses are the student's uncoached reading in one run (heard as clear enough) and the slow greeting in another (its stops are acted, and heard as deliberate). On whole recordings, hearing keeps about half of what the text model faults: 3.6 of 7.5 places a minute in the coach's lessons, 5.6 of 8.4 in the user's poorer take and 1.7 of 3.8 in its good retake. Of the breaks alone, 74% of the poorer take's sound hesitant, 27% of the retake's and 14-35% of the coach's.

## Volume

Volume problems are what the course's volume lesson demonstrates (dropping to "3 out of 10") and what its pause lesson demonstrates (trailing off at the end of sentences). A recording's level depends on the microphone, its gain and distance as much as on the voice, so `volume.ts` never judges absolute level. A take that is quiet throughout can't be told from a low microphone and is never flagged. Both checks compare the speaker with their own typical word in the body of a phrase, in the same recording. A word's loudness is its loudest part, so loose word timing doesn't lower it. Volume uses the recognizer's word timing, in uploads and in the benchmark: forced alignment trims a fading voice as if it were silence. Highlights are moved onto the aligned transcript. No language model is involved.

- **Trailing off** (`VOLUME_FADE`). Phrases end at a full stop or a 0.3 s silence. A phrase's last second is flagged when it is at least 12 dB below normal and another of the two judged endings on either side is too. One low ending is ordinary falling intonation: everyday speech often has one at 10–14 dB, but never two in three at 10 dB. The coach's demonstration drops 16–17 dB three times running.
- **Volume drop** (`VOLUME_LOW`). 10 s of phrase bodies (endings excluded) whose level plus brightness (energy above 1 kHz relative to below it) is at least 10 dB below normal. A voice that gets softer with effort also gets duller, whatever the microphone gain. A shorter quiet line can be deliberate. Untrained talks stay within 6.4 dB and the coach's teaching within 9.8 (a stretch with music under it). The coach's "3 out of 10" drops 12.3 dB within its full lesson, but only 8.9–10.9 dB in the benchmark's 1.7-minute clip, depending on the transcript. Uploaded on its own, that clip is missed. This is the weakest check: it catches only large, sustained drops in a long enough recording.
- Only frames within 35 dB of the loudest and at least 6 dB above the background count as voice. A trailing-off voice that sinks into the noise can't be judged, so it isn't. Less than 5 s of voice or undecodable audio is uncertain.

Held out (the coach's three other lessons, 22 practice talks and a good retake, about 3.4 h), no everyday speech is flagged, clean or degraded. The one mark is the coach's deliberately sad greeting in the tonality lesson (0:57–1:13, 11.1 dB). Degrading the recording costs detections, never adds false alarms:

| Recording                                                   | "3 out of 10" (full lesson) | Trail-off (3 endings) |
| ----------------------------------------------------------- | --------------------------- | --------------------- |
| Clean, or 20 dB quieter                                     | found                       | 3                     |
| Laptop microphone (bass cut below 250 Hz) or telephone band | found                       | 0                     |
| Fast automatic gain control                                 | missed                      | 2                     |
| Noise at 30 dB / 20 dB below the voice                      | missed                      | 3 / 0                 |

Mild fades aren't caught: the voice-pack reading `volume-01` ends 9–11 dB down, within everyday intonation. Its `volume-02` is quieter than another take throughout, which one recording can't show.

## Volume benchmark

`benchmarks/volume-development.json` cuts six clips from the volume and pause lessons: the two demonstrations, each inside a minute or more of the coach's normal speech, and four clips of normal teaching. The eval transcribes each clip on its own, as an upload is, and caches the reply; it needs `DEEPGRAM_API_KEY` on the first run. The student example is excluded: each of its readings changes level throughout. These clips chose the thresholds, so the gate is a sanity check; the held-out results above are the evidence. It currently fails on the "3 out of 10" clip (8.9 dB).

```sh
pnpm import:volume --videos-dir /path/to/videos --ffmpeg /path/to/ffmpeg
# Optional: --transcripts-dir /path/to/cache reuses <video stem>.deepgram.json.
pnpm eval:volume --require-pass
RECORDINGS_DIR=recordings-volume-development pnpm markup-tools
```

`import:volume` runs the rate importer with `--recipe benchmarks/volume-development.json`. The report is `recordings-volume-development/volume-benchmark.json`; matching works as for rate.

## Tonality

Tonality is the emotion underneath the voice. The course's main tonality problem is the **blank face**: under stress the face goes still and the emotion drains out of the voice. `tonality.ts` judges the voice and the words separately, each with a model suited to it:

- **Voice:** Gemini (`GEMINI_MODEL`, default `gemini-3.5-flash`) listens to each passage and rates how expressive the voice sounds, from 1 (flat, blank) to 5 (vivid), in `gemini.ts`. It is told to ignore what the words say.
- **Words:** a text model (`TONALITY_MODEL`, default `gpt-6-sol` at `TONALITY_EFFORT=low`) reads the whole transcript once and lists, per passage, every emotion a skilled speaker's voice could carry there, and whether a calm, matter-of-fact voice would serve as well. It never hears the audio. Delivery has many valid readings, so this is a set.
- **Flat voice (`TONE_FLAT`):** a passage is flagged when its voice is rated `TONALITY_FLAT_SCORE` (default 2, "mostly flat") or lower where the words call for feeling. Adjacent flagged passages form one highlight. The note names the feeling the words call for ("…while the words call for warmth or enthusiasm") and follows the lesson: decide what the passage should feel like and let the face lead.
- Passages are sentences joined to **10–30 s**, so each rating hears enough voice. These two lengths and the flagged score are the whole configuration (`DEFAULT_TONALITY_CONFIG`).
- Without decodable audio, Gemini or the text model, tonality is uncertain rather than clean.

**Sensitivity.** `TONALITY_FLAT_SCORE` sets which ratings count as flat (1–4). On held-out recordings, the share of speaking time flagged was:

| Flagged score   | Vinh's lessons | Your talks | Your retake |
| --------------- | -------------- | ---------- | ----------- |
| 1               | 0%             | 1%         | 0%          |
| **2** (default) | **0%**         | **35%**    | **33%**     |
| 3               | 0%             | 60%        | 48%         |

These come from 141 passages, so treat them as rough. Don't tune the score to make every example come out right: delivery has many valid readings.

**What it does not do.** It doesn't judge _which_ emotion the voice carries. On natural speech emotion labels are unreliable, and a rule comparing exact emotions flagged 27–54% of Vinh's teaching. Vinh's blank-face demonstration is visual rather than audible, so it isn't a fair test (Gemini rates it low, but its words say "I don't have much emotion", and that judgment vanishes when the words are filtered out). A single short phrase isn't judged either.

**How well it works.** Gemini hears the voice, not only the words: with the words filtered out (400 Hz low-pass), it still rated every Vinh lesson clip above every one of your talks, and your expressive reading above your flat one. On a single passage its rating is coarse: your expressive reading scores 2 on its own, and is unflagged only because the text model says a calm voice suits that paragraph. The same clip gets the same rating in about 72% of repeat runs. Findings are tentative. See [tonality research](docs/tonality-research.md).

**Cost and privacy.** Audio is billed at 32 tokens per second. One rating costs about $0.0035, about $0.01 per minute of speech, plus one text-model call per take. Each passage's audio is sent to Google's Gemini API, so the paid tier is required: on the free tier Google may use the data to improve its products. `GEMINI_MODEL=gemini-3.1-pro-preview` also works. It was slightly sharper on single clips but changed its rating between runs far more often (43% of clips rated the same twice).

### Tonality benchmark

`benchmarks/tonality-development.json` cuts Vinh's Tonality lesson into six clean teaching excerpts and his three bad-tonality demonstrations, and adds your flat and expressive readings of one paragraph from the voice pack (`Recording (39).m4a`). The demonstrations are **excluded** from scoring, with the reason recorded: the greetings are single 1.5 s phrases, and the blank face isn't audible. The evaluation still analyzes and lists them. One scored positive makes this a smoke test, not an accuracy measure.

```sh
pnpm import:tonality --videos-dir /path/to/videos --speech-dir /path/to/voice-pack-sources --ffmpeg /path/to/ffmpeg
# --transcripts-dir reuses <video stem>.deepgram.json; the speech dir holds Recording (39).m4a and Recording (39).deepgram.json.
pnpm eval:tonality                       # Gemini ratings and text-model replies are cached per run
pnpm eval:tonality --label-run repeat-1  # an independent set of ratings and replies
TONALITY_FLAT_SCORE=3 pnpm eval:tonality # try another sensitivity (reuses the cache)
RECORDINGS_DIR=$PWD/recordings-tonality-development pnpm markup-tools
```

The importer is shared with rate, pauses and volume (`scripts/import-rate-benchmark.ts --recipe <benchmarks/*.json>`). The report is `recordings-tonality-development/tonality-benchmark.json`.

## Pitch & melody

The course teaches melody as "the different notes that you can hit": a voice that moves is easier to follow and remember, and anything distracting takes away from the message. `pitch.ts` reports a voice that gets stuck, each judged over 10 s of speaking. An audio model can add what measurement can't hear, but only where the measurement agrees.

- Pitch is tracked every 10 ms (McLeod pitch method, `pitchy`), only inside spoken words, so music and noise between words don't count. Values that jump away from their neighbours, such as octave errors, are dropped. Semitones measure pitch relative to the speaker's own voice, so a voice is never judged against anyone else's.
- **Monotone** (`PITCH_VARIETY`): pitch standard deviation below **2.6 semitones**. The threshold isn't fitted to our recordings. It comes from [Hincks (2005)](https://www.isca-archive.org/interspeech_2005/hincks05_interspeech.pdf): over 10 s of speech, listeners rated a standard deviation below 15% of the mean pitch as monotone, which is 2.6 semitones. Clips with less speech are judged whole, and a talk that is flat throughout is flagged throughout.
- **Stuck high or low** (`PITCH_HIGH`, `PITCH_LOW`): the stretch's median pitch is **7 semitones** or more from the speaker's normal, their median in the same recording. A squeak needs only **5 s an octave (12 semitones) up**: over 5 s, excited speech reaches 10 semitones up for a moment, a falsetto 19. A stretch stuck high or low isn't also called monotone.
- A flagged window marks its middle half, so a mark can reach a sentence or so into the speech around it. Under 5 s of speech, under 2 s of voiced pitch, missing word timing or undecodable audio gives an uncertain assessment.

The pitch lesson has no demonstration of a flat or stuck voice by the coach. His deliberate mistakes in other lessons (constant pace, "3 out of 10" volume, the "blank face") keep 3.0–4.4 semitones of movement, but his voice drops to a low register for "3 out of 10" and for the sad-face exercise in the tonality lesson. The user's three readings of one paragraph supply the high and flat examples.

### Monotone

On recordings that played no part in choosing anything, as a share of speaking time flagged:

| Recording                                                | Flagged           |
| -------------------------------------------------------- | ----------------- |
| Coach, volume, pitch and tonality lessons (19 min)       | 0–4%              |
| 22 untrained practice talks (2.9 h)                      | 0–48%, median 20% |
| A good retake of one talk / the original, poorer take    | 3% / 14%          |
| Course student before / after coaching (another speaker) | 78% / 50%         |

Of the coach's two marks, one is mostly the student's reading in the tonality lesson; the other is his calm closing of the volume lesson (2.37 semitones). Of the user's 14 voice-pack readings of one paragraph, the two marked flat for pitch or tonality are flagged and the two good ones aren't. Seven of the other ten are flagged too: they were recorded for rate, pauses or volume, and pitch was never judged.

The margin on the clean side is thin: the good reading sits at 3.0 semitones and the coach's "3 out of 10" at 3.0. A flat stretch with under 10 s of speaking between moving speech isn't caught: the user's flat reading (8.5 s) is flagged on its own but not between the other two readings.

### Stuck high or low

The largest shift of any 10 s of speaking from the speaker's normal:

| Recording                                       | Shift                                       |
| ----------------------------------------------- | ------------------------------------------- |
| 22 untrained practice talks and the good retake | −2.9 to +3.8 semitones                      |
| Coach's normal teaching                         | −4.1 to +5.0 (+6.5 impersonating a student) |
| Coach's "3 out of 10" / sad-face exercise       | −10.5 / −9.3                                |
| The user's high reading among their three       | +17.4                                       |

So 7 semitones sits in a wide gap. The practice talks, retake and other voice-pack recordings get no register mark at any value from 5 to 10, the coach's normal teaching gets none from 7 up, and his deliberate drops are caught up to 9. His other marks are other speakers (the students in the pitch and tonality lessons) and the siren demonstration (+11.5).

**What it can't see.** The comparison needs normal speech in the same recording. A take that is high or low throughout can't be told from a naturally high or low voice, since men's, women's and children's voices overlap, so it isn't flagged: the high reading alone isn't. The normal is the recording's median, so the more of a take is shifted, the smaller the shift looks; a shifted stretch must be a minority of the take.

### Listening

`pitch-listen.ts` sends the audio to Gemini (`GEMINI_MODEL`, default `gemini-3.5-flash`) in chunks of about 30 s, cut between words. On a whole 5-minute talk it returns nothing. For each stretch where pitch is a problem, it gives an issue (too high, too low, monotone, sing-song), a severity from 1 (badly distracting) to 5 (fine), what the voice does wrong and a fix. Moving pitch on purpose for emphasis is defined as good delivery. Without `GEMINI_API_KEY`, or if a call fails, pitch is measured only. A 5-minute talk takes about 22 s, alongside alignment.

A heard stretch becomes a mark only at severity 1–2 and only when the measured pitch agrees in that stretch:

- **Monotone:** spread under 2.6 semitones.
- **Too low:** 7 semitones or more below normal; if it is merely flat, it becomes a monotone mark.
- **Too high:** an octave above normal, or above 350 Hz. The 350 Hz bar is above everyday speaking for men and women, and is the only way a take high throughout can be flagged.

Marks show the model's description and fix where it heard the same problem over them, at severity 3 or worse; otherwise the standard wording.

Why the measurement must agree, from about 200 calls:

- **Labelled short clips:** severity 1–2 caught all five of the user's high, flat and quiet readings in two runs, including the falsetto reading alone. That is something measurement can't do.
- **Words muffled:** the coach's demonstrations were still heard as problems with the words muffled (low-passed), so it hears the voice, not the words.
- **Everyday speech:** it rates nearly every problem a 3, so a severity cut alone barely fires. Its severity-2 calls on good delivery (the good retake "monotone" for 27 s, the blank-face demonstration, the coach's excited "That was fantastic!", the good tonality reading) all measure as moving or within range, so none becomes a mark.
- **Run-to-run:** on the original selection-bias take, one run rated nothing badly distracting and another rated two stretches 2. Both measured as moving. The marks were identical in both runs; only the descriptions varied.
- **What it adds:** on the benchmark, the flat reading between the other two, which a 10 s window misses, so the benchmark scores 4 found, 0 false alarms and 0 misses. On everyday talks it adds descriptions, not marks.

Its voice-quality words aren't verified. It describes "gravelly vocal fry at the end of the phrase" in 12 of 15 notes on the original take, against 5 of 12 on the retake. But measured creak (pitch under 90 Hz and an octave below the speaker's median) is 1.2% of phrase endings there and 3.5% on the retake.

Degraded copies (20 dB quieter, laptop bass cut, telephone band, automatic gain control, pink noise 20 dB down, 32 kbps MP3) never add a mark of either kind. Bass cut and telephone band make the tracker hear more movement and lose monotone detections; noise can make a take uncertain.

### Pitch benchmark

`benchmarks/pitch-development.json` has fourteen takes:

- **Coach, natural:** seven teaching clips from the pitch lesson, excluding the music, the acted sketch, the student's siren exercise and the siren demonstration.
- **Coach, other foundations:** his constant-pace and blank-face demonstrations (clean), and "3 out of 10" inside his normal speech (`PITCH_LOW`).
- **The user's readings** (the voice-pack pitch source, `--speech-dir`): all three together (`PITCH_HIGH` on the first, `PITCH_VARIETY` on the second), and the flat and good readings alone.

Measured only, with forced alignment, it scores 3 found, 0 false alarms and 1 miss: the flat reading between the other two, which is shorter than a window. With listening (`--listen`) it scores 4, 0 and 0. With recognizer timing (`--recognizer-timing`), which stretches words over pauses, measurement alone catches that reading too. The thresholds weren't chosen from these takes, so the benchmark is a sanity check; the held-out results above are the evidence.

```sh
pnpm import:pitch --videos-dir /path/to/videos --speech-dir /path/to/voice-pack-source --ffmpeg /path/to/ffmpeg
# Optional: --transcripts-dir /path/to/cache reuses <video stem>.deepgram.json.
# The voice-pack source directory holds "Recording (40).m4a" and "Recording (40).deepgram.json".
pnpm eval:pitch
pnpm eval:pitch --listen   # adds Gemini; replies are cached per chunk next to each take
```

The report is `recordings-pitch-development/pitch-benchmark.json`; matching works as for rate.

## Strengths

A review also points out what the speaker does sincerely well: not passages that merely pass, but ones that look like the course coach at his best. Each strength is pinned to the words where it happened, says what was measured or heard there and why it works, in the lesson's own terms, and its practice note is to keep it and use it again. Strengths are findings with `kind: "strength"`; they don't change a foundation's verdict, which still describes problems. Each foundation lists its strengths in an `as const` array (Node's type stripping doesn't support TypeScript `enum`), and the diagnostics carry them as `strengths`.

| Foundation | Strengths                                                            | Found where                                                                                                                                                                                                                                                              | Why it works                                                                                              |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Rate       | `RATE_STRENGTHS`: `RATE_SLOWS_FOR_POINT`                             | A phrase the pacing prediction says to slow down on, spoken at 62% or less of the speaker's median phrase pace, outside any rate mark and with no broken-up pause inside it                                                                                              | Slowing down on what matters is a verbal highlight: it tells the listener what to focus on                |
| Pauses     | `PAUSE_STRENGTHS`: `PAUSE_LETS_IT_LAND`, `PAUSE_BUILDS_ANTICIPATION` | A pause of 0.6 s or more that a text model places right after a line meant to land, or right before a set-up reveal or answer, and that Gemini hears as deliberate rather than hesitant; the pause review doesn't fault it. At most two a minute, the longest-held first | The silence gives the listener time to process the point; holding back what comes next makes them lean in |
| Tonality   | `TONE_STRENGTHS`: `TONE_EXPRESSIVE`                                  | A passage Gemini rates 4 (clearly expressive) or 5 (vivid) where the words call for feeling, and above the take's own median rating                                                                                                                                      | Listeners connect with the feeling in the voice, not only the words                                       |
| Pitch      | `PITCH_STRENGTHS`: `PITCH_MELODY`                                    | The liveliest 10 s windows with a pitch standard deviation of 4.5 semitones or more inside the speaker's normal register, apart from each other and at most one per minute of speaking, minus any pitch mark or badly distracting problem Gemini heard                   | Melody tells listeners what matters and makes the message easier to remember, the way a song is           |

Volume has none. Recorded level can't be told from microphone gain, Gemini can't hear projection, and holding volume through a sentence is what everyday speech already does, so there's nothing sincerely great to measure.

**Standouts, not norms.** A strength is a moment to point at. The first version marked everything above each bar, and on one of the coach's own videos one tonality strength covered 90% of the take and one pitch strength 75%. Now a tonality passage must be rated above the speaker's usual passage in the same take, and pitch and pause strengths are the strongest few per minute. When the whole take clears the bar, the foundation's summary says so ("Your voice is expressive throughout this take. The marked passages are the most vivid.") instead of the highlight.

What was tried and dropped, so it isn't tried again:

- **Pauses from text alone.** The text model praised 36-42% of held pauses, in the coach's lessons and untrained talks alike, including obvious searching ("where he said, you know, [2.4 s]"). Listening to each candidate in context separates them: Gemini heard 90% of the coach's candidates as deliberate and 1% as hesitant, against 41% and 18% for untrained speakers. Duration doesn't help: untrained speakers' held pauses are longer than the coach's.
- **Pitch lifted on the point.** Measured, the coach's key phrases (pacing −2) rise no more than his setup phrases, also with sentence declination taken out. Gemini's own list of pitch highlights gave about one per 30 s chunk for everyone. How much the melody moves over 10 s is what separates him: his windows' median is 4.2-4.7 semitones per lesson, untrained talks' 2.7-3.6 (one 4.2).

### Settings

Every number above is a setting, kept in a config object next to the code that uses it and gathered by `reviewConfig()` (`review-config.ts`), which the live review and `eval:strengths` both read. Environment variables override them without a release; an invalid value stops the review with the variable's name rather than being ignored. The figures in this README describe the defaults, so measure a change with `pnpm eval:strengths` and `pnpm eval:pause --listen` before keeping it.

| Variable                                                 | Default | Meaning                                                                                                                                     |
| -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `STRENGTHS`                                              | 1       | 0 reports no strengths                                                                                                                      |
| `STRENGTH_RATE_PACE_PERCENT`                             | 62      | A key phrase at this share of the usual pace, or slower                                                                                     |
| `STRENGTH_RATE_SCORE`                                    | -1      | ...scored this or lower by the pacing prediction (-2 or -1)                                                                                 |
| `STRENGTH_PAUSE_SECONDS`                                 | 0.6     | Shortest pause that can be a strength                                                                                                       |
| `STRENGTH_PAUSES_PER_MINUTE`, `STRENGTH_PAUSES_AT_LEAST` | 2, 2    | Most pause strengths named per minute; a short take may still have the second                                                               |
| `STRENGTH_TONE_SCORE`                                    | 4       | Expressiveness rating a passage needs (1-5)                                                                                                 |
| `STRENGTH_TONE_ABOVE_USUAL`                              | 1       | 1 marks only passages above the take's median rating; 0 marks every passage at the score                                                    |
| `STRENGTH_PITCH_SPREAD`                                  | 4.5     | Pitch standard deviation over 10 s of speaking, in semitones                                                                                |
| `STRENGTH_PITCH_PER_MINUTE`, `STRENGTH_PITCH_AT_LEAST`   | 1, 1    | Most lively stretches named per minute of speaking; a short take may still have the second                                                  |
| `PAUSE_HEAR_BREAKS`, `PAUSE_HEAR_MISSING`                | 1, 1    | Whether a "breaks the thought" finding must sound hesitant, and a "missing pause" must sound like running on; 0 leaves it to the text model |
| `PAUSE_HEAR_LEAD_IN_SECONDS`, `PAUSE_HEAR_AFTER_SECONDS` | 6, 2.5  | Audio the model hears before and after a pause                                                                                              |

Settings without a variable are in the same objects and need a code change: which sound a praised pause must have (`sounds`), how many words a pause highlight spans, and which pause findings undo a strength (`faults`). The prompts are not settings: a changed prompt needs its benchmark rerun.

### Strength benchmark

`benchmarks/strength-development.json` takes the coach's five whole lessons as the reference for great delivery, with three kinds of evidence in source time:

- **Moments he performs and then names:** "make sure you slow down", followed by "Notice how that bit there just seemed critical", and two pauses, each followed by "Notice how you're processing…".
- **His deliberate mistakes**, which must not be praised for that foundation: the slow and rushed greetings, the constant-pace demonstrations, "3 out of 10", the blank face, the filler-laden and run-on examples.
- **Students before and after his coaching:** the rate lesson's reading, the tonality lesson's romantic passage and the Gladiator lines.

Music, sketches, students and demonstrations are left out of his rates (`notTeaching`). The eval also runs on any other recordings, by group.

```sh
pnpm eval:strengths /path/to/recordings.json [--run repeat-1] [--report out.json]
# recordings.json lists { name, group, audio, transcript, source? }: a PCM WAV, its Deepgram JSON and, for a
# lesson decoded whole from its video, the video's file name, which links it to the recipe.
```

One run with the standout rules (the first version's figures, everything above the bar, in brackets):

| Group                                          | Minutes | Rate (per min) | Pauses (per min) | Tonality (share of speech) | Pitch (share of speech) |
| ---------------------------------------------- | ------- | -------------- | ---------------- | -------------------------- | ----------------------- |
| Coach, teaching only                           | 19      | 0.63           | 1.7 (4.2)        | 26% (96%)                  | 8% (62%)                |
| One of the coach's YouTube videos              | 2.4     | 0.82           | 0                | 25% (90%)                  | 7% (75%)                |
| 16 untrained talks, used to set the thresholds | 80      | 0.14           | 1.2 (1.3)        | 5%                         | 2% (4%)                 |
| 5 untrained talks, held out                    | 46      | 0.06           | 1.2 (1.1)        | 3%                         | 1% (2%)                 |
| A good retake of one talk                      | 4.2     | 0.24           | 1.9 (2.2)        | 0%                         | 6% (11%)                |
| The original, poorer take of that talk         | 4.6     | 0.22           | 1.7              | 18%                        | 0%                      |

- The three moments the coach names are found.
- None of the 12 deliberate mistakes is praised. Before the standout rule, the passage that straddles the end of the blank face was. A pause is scored by the word it follows, so the pauses before a demonstration begins ("Imagine I started it like this. [1.6 s] Hi,") don't count as praising it.
- Coached pairs: the Gladiator lines get one pause strength after coaching and none before, and the tonality student's reading goes from 0% to 36% praised. The rate lesson's student gets no rate strength in either reading.
- The budgets flatten the pause and pitch gap between the coach and untrained speakers: what still separates them there is the summary and the issues. The YouTube video has no pause strength because it has no pause over 0.5 s: the edit cut them.
- The retake gets more pause and pitch strengths than the original take, but less tonality: Gemini rates the original take's voice more expressive.
- The user's five short voice-pack readings get no pitch or tonality strength. A clip of one passage has nothing to stand out from; if it is expressive or lively, the summary says so.

The thresholds are few and coarse: 62% of the usual pace, 0.6 s, Gemini's own "clearly expressive", the coach's typical melody, and one or two strengths a minute. They were set by looking at the coach's lessons and the 16 design talks; the 5 held-out talks were measured once at the end. Speech allows many good deliveries, so the target is a clear gap between the coach and untrained speakers, not a perfect score. The coach's lessons are edited, and jump cuts remove pauses, so his pause rate is a floor. The standout rules were added after seeing one YouTube video light up; they use no figure from it, and it is listed above for what it is, one more recording.

**Cost.** Pause strengths add one text-model request per 120-word part, the same as the pause review, plus a Gemini call with about 9 s of audio per proposed pause: roughly $0.005-0.01 per minute of speech. The two pause requests run in parallel and each part sends the whole transcript, so takes over about 10 minutes can hit a 200k tokens-per-minute limit. Either can then fail: the pause review is reported as not assessed, and pause strengths are left out. Hearing the pause review's breaks and missing pauses adds one such Gemini call per place the text model faults, about 4-10 a minute.

## Research and evaluation

- [MVP research](docs/mvp-research.md)
- [Video lessons and feasibility probe](docs/video-review.md)
- [Tonality: what can be heard, and which tools hear it](docs/tonality-research.md)
- [Visual review research](docs/visual-review.md)
- [Competitive landscape](docs/competitive-landscape.md)
- [Yoodli assessment](docs/yoodli-assessment.md)

The repository's course clips demonstrate measurable differences, but they do not establish coaching accuracy. No blinded human pilot or competitor comparison has been run yet.
