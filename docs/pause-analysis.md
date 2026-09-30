# Pause analysis

The live path is `transcribe → analyzeSpeech → deliveryReview`. `analyzeSpeech` finds the message and makes the existing chunked importance-labeling requests with pause context enabled. There is no separate model request for pauses. Both analyzers retain original word indexes and times.

## Rubric and evidence

Rule IDs come from the golden-set annotator, with the coaching rationale from [the pause lesson review](video-review.md#5-pause--0628) and [the research](mvp-research.md). The research's earlier `PAUSE_PROCESSING` name corresponds to the golden set's `PAUSE_NECESSARY`; the new detector emits only the golden IDs.

| Rule | Context and delivery evidence |
| --- | --- |
| `PAUSE_NECESSARY` | A clearly identified processing boundary after a key point or complex idea, with little space before the next thought. Punctuation or importance alone is insufficient. |
| `PAUSE_UNNECESSARY` | A gap breaking clearly connected words, or an unusually long ordinary transition compared with nearby pauses. Flexible dramatic readings and tentative judgments are withheld. |
| `PAUSE_FILLERS` | Semantically empty words/sounds, repeated first attempts, or abandoned starts identified by the shared labels. Meaningful discourse words and intentional repetition remain speech. |

The meaning stage sees the transcript and indexes of observed gaps, not model-generated durations. Its boundary categories are internal contextual evidence, not additional coaching rules. Chunk seams include the following numbered word; each boundary belongs to the chunk containing its left word. Invalid, out-of-range and conflicting model boundaries are rejected or made tentative.

`wordGaps` measures gaps only between valid, nonoverlapping original adjacent words. It does not bridge missing alignment, count filler duration as silence, or infer silence before/after the recording. Rate phrases can still split at fillers, but their emphasis evidence now uses actual gaps rather than skipped filler duration.

`PauseConfig` contains conservative, uncalibrated defaults: 0.5 s minimum at clear processing boundaries; 0.6 s maximum inside clearly connected phrases; ordinary transition gaps must exceed both 2.5 s and three times a local median, with at least three neighboring gaps. These are implementation heuristics, not timings prescribed by the lesson or validated universal norms. Long dramatic pauses are not automatically faults. Adjusting thresholds requires varied labeled deliveries, not matching recording-03 more closely.

All matches, including overlapping golden rules, remain in `candidates`. `marks` selects up to two per minute by impact. The live review combines related filler/hesitation or rushed-point/missing-pause advice, retains related rule IDs, and selects at most three priority notes across rate and pauses. Pins point at the gap or filler, and word highlights can cross display segments. The pause lane uses the same measured gaps as the detector.

## Evaluation

```sh
pnpm --dir packages/vocal-processing eval:pauses
pnpm --dir packages/vocal-processing eval:pauses recording-03 recording-27
pnpm --dir packages/vocal-processing eval:pauses --include-crops --cached-only
```

The script caches model labels by transcript, prompts/schema, model and effort. `--fresh` relabels; `--cached-only` skips files without matching labels. It never tunes defaults. It writes `<id>.pauses.pred.json` for the annotator's Pauses → Pipeline view, showing all candidates and which were selected.

Golden boundaries must bracket both predicted adjacent words. Fillers are matched by word-span overlap. Matching is one-to-one, so several predictions touching a broad annotation cannot inflate true positives. Reports distinguish all candidates from selected notes.

Development/held-out assignment is a stable hash of the source recording ID. Crops inherit their source's assignment. Source recordings are preferred for totals, and additional crops of that source are diagnostic only. Unannotated recordings produce predictions without a precision/recall claim. This split is a guard against leakage, not proof that the present corpus has enough independent labeled examples.

Initial smoke evaluation on 29 September 2026, with frozen defaults and `gpt-6-sol:low`:

| recording-03 rule | Candidate precision against golden marks | Golden recall |
| --- | --- | --- |
| `PAUSE_NECESSARY` | 0/2 | 0/8 |
| `PAUSE_UNNECESSARY` | 11/13 | 11/19 |
| `PAUSE_FILLERS` | 4/13 | 4/5 |

The detector selected ten pause notes before the live review's three-note cap: eight matched golden annotations. This is a development diagnostic, not a general coaching accuracy score. Missing-pause recall is weak, and many filler candidates are unmarked in this sparse golden set. No thresholds or prompts were changed to fit these results. Recording-27 completed as an independent, unannotated smoke check, yielding three unnecessary-pause candidates and no missing-pause or filler candidates.

## Limits and next validation

ASR gaps estimate silence; breaths, omitted fillers, noise and alignment errors can distort them. The local research demonstrated unreliable word boundaries, so acoustic verification/alignment remains needed before stronger claims. Live findings are tentative. The absence of detected fillers is not presented as proof of filler-free speech. A take without detected pause issues receives an uncertain assessment with an explicit description of the available evidence.

Tests cover processing versus connected boundaries, multiple valid pause lengths, slow and dramatic delivery, repetitions/false starts, invalid timestamps, chunk boundaries, rate/filler interactions, overlapping rules, source grouping, and precise review pins. They do not establish model judgment accuracy. Further calibration needs independently annotated recordings across speakers and delivery styles, including valid alternatives and good retakes; keep entire source groups out of tuning.
