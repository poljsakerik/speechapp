# Coaching quality pilot

Status: **Deferred until recordings and credentials are available.** The user will add API keys in `.env` and review the results manually. No fresh recordings or listener ratings are available in this repository. The course clips and acoustic probe are feasibility examples, not independent judgments of coaching quality. This study is a future product-quality assessment, not a completed implementation check.

## Recordings

Record five pairs from at least two speakers. Within each pair, use identical words, the same microphone, and the same gain. Cover rate, volume, pitch/melody, tonality, and pauses. Include at least two pairs where both performances are acceptable in context; the reviewer should not be rewarded for finding a fault everywhere. Keep the speaker's intended effect and the two intended deliveries in a private answer sheet.

After adding the Deepgram and Mistral keys to `.env`, use `python -m scripts.compare_reviews <ten recording paths>` to make direct-audio and acoustic-assisted reviews in `/tmp/speechapp-comparison`. Share only `rater-packet/` with listeners; it contains each clip's audio, timed transcript, and two reviews. Keep `private-answer-key.json` outside their packet. The exported reviews remove acoustic feature identifiers in both conditions. The script processes one recording and one review at a time. The two conditions use the same audio, transcript, lesson rubric, and prompt; only the acoustic measurements differ.

## Blind judgment

Have two listeners read the paired outputs without the answer key. For each foundation, rate lesson fidelity, contextual correctness, specificity, and usefulness from 1–5. Mark unsupported claims, manufactured errors on acceptable deliveries, and the exact passage where useful feedback applies. Record whether a review correctly says there is no clear problem. Resolve disagreements by keeping both ratings rather than silently choosing one.

After following feedback on at least three passages, record second takes. Present original and revised takes to listeners in random order and ask which better communicates the intended meaning. Record ties. Compare the two model conditions only after ratings are complete. The study is too small for a broad superiority claim, but it can reveal whether measurements add useful coaching and where the five-foundation rubric fails.

| Clip pair | Foundation | Direct-audio mean | Hybrid mean | Unsupported criticism? | Notes |
|---|---|---:|---:|---|---|
| 1 | Rate | — | — | — | Pending recording and review |
| 2 | Volume | — | — | — | Pending recording and review |
| 3 | Pitch/melody | — | — | — | Pending recording and review |
| 4 | Tonality | — | — | — | Pending recording and review |
| 5 | Pauses | — | — | — | Pending recording and review |

A claim about competitors requires actual competitor reviews of the same recordings, judged by the same listeners. None has been run here.
