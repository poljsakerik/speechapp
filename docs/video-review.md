# Coaching video review and local feasibility probe

Reviewed on 25 September 2026. The five files total **30 minutes 44 seconds**.

Method: decoded all five files, generated full local timestamped transcripts with `faster-whisper small.en`, inspected nine evenly spaced visual frames per video, and ran exploratory acoustic measurements on selected demonstrations. This is a transcript-and-frame review with audio signal analysis, not an uninterrupted audiovisual viewing or a human listening evaluation. Automatic transcription has visible errors and its word boundaries are approximate. Times below are navigation references; verify exact boundaries before curating evaluation clips.

The videos remain the source of the coaching approach. Descriptions below paraphrase that approach; they do not endorse every broad psychological claim in the lessons as established scientific fact.

## 1. Rate of speech — 05:37

Source: [02-Rate of Speech.mp4](../videos/02-Rate%20of%20Speech.mp4).

| Time | What the lesson covers | MVP interpretation |
|---|---|---|
| 00:29–00:40 | Deliberately slow greeting | Detect slow passages, but do not automatically label slowness wrong |
| 01:08–01:15 | Deliberately rapid introduction | Measure local rate and compare with surrounding delivery |
| 01:30–02:48 | A constant rate can become monotonous even if initially engaging | Look for sustained lack of variation, rather than one “correct” WPM |
| 02:49–03:33 | Slow important points; move faster through less important material | Identify likely key points in text, then check relative pacing |
| 03:52–04:27; 04:31–05:09 | Student examples before and after varying pace | Useful demonstrations, but the passages contain different words |

**Rule `RATE_IMPORTANCE`:** On a clearly important phrase, consider a suggestion if the speaker speeds through it without another emphasis cue. A slower rate, a pause, or another clear emphasis cue may already serve the purpose.

**Rule `RATE_VARIETY`:** Over a sufficiently long passage, flag sustained uniformity only if it appears to weaken the delivery. Do not reward random variation for its own sake. The coach gives no universal numeric threshold.

## 2. Volume — 06:24

Source: [03-Volume.mp4](../videos/03-Volume.mp4).

| Time | What the lesson covers | MVP interpretation |
|---|---|---|
| 00:32–01:11 | Subjective 1–10 scale; coach demonstrates about 7 and associates 6–7 with projected confidence, authority, and vitality | Treat the numbers as the coach's teaching scale, not calibrated decibels |
| 01:16–01:40 | Coach demonstrates about 3/10 | Compare dynamics within the recording; quietness alone is not evidence of low confidence |
| 02:04–03:00; 03:04–04:03 | Student delivers a motivational script with changed projection | Promising paired content, with coaching and other changes mixed in |
| 04:33–06:20 | Greater projection can feel excessive because it is unfamiliar | Offer a practical second-take exercise without claiming to know the speaker's feelings |

**Rule `VOLUME_PROJECTION`:** Identify passages that become hard to hear or lose projection relative to surrounding speech. With arbitrary recordings, absolute recorded level cannot establish whether the speaker was too quiet in the room.

**Rule `VOLUME_ENDINGS`:** Check for repeated fading at sentence endings, especially when the fading obscures an important word. Link the suggestion to pausing and taking a breath, as the pause lesson describes. Do not diagnose the cause of the fade from audio alone.

The lesson also discusses facial expression and body language. An audio-only MVP cannot measure those changes directly.

## 3. Pitch and melody — 06:45

Source: [04-Pitch & Melody.mp4](../videos/04-Pitch%20%26%20Melody.mp4).

| Time | What the lesson covers | MVP interpretation |
|---|---|---|
| 00:14–01:57 | Different vocal notes, melody, and memorability | Measure melodic variation; avoid promising a quantified memory benefit |
| 02:05–04:20 | Instrumental music and associated meaning | The lesson explicitly shows why meaning cannot be recovered from words alone |
| 04:26–04:59 | Student repeats a line with directed pitch changes | An exploratory range exercise, with coach commands in the audio |
| 05:29–06:31 | Siren exercise: read while gradually moving low–high–low | Offer as practice for comfortable range, not a required contour for every sentence |

**Rule `PITCH_VARIETY`:** If several phrases show little melodic movement and delivery seems flat, suggest more meaningful contrast on one chosen phrase. Compare within the speaker's range; a low natural pitch is not a fault.

An exaggerated siren is a training exercise. A larger pitch range is not automatically a better performance. Pitch and the emotional tone of a voice are related but are distinct foundations in this course.

## 4. Tonality — 05:31

Source: [05-Tonality.mp4](../videos/05-Tonality.mp4).

| Time | What the lesson covers | MVP interpretation |
|---|---|---|
| 00:15–00:30 | Distinguishes emotional meaning from pitch notes | Do not equate pitch range with emotion |
| 00:31–01:43 | Six emotion labels and contrasting greetings | Use as the coach's exercises, not an exhaustive classifier of human emotion |
| 01:47–02:05 | Facial expression described as a way to inject emotion into words | Suggest an expression exercise; do not claim to have detected the face from audio |
| 02:30–02:54 | Deliberately blank delivery | A candidate example of limited expressive variation |
| 03:39–04:02; 04:12–04:43 | Student reads a romantic passage, then follows changing facial-expression prompts | Shows expressive range; individual prompted emotions are not necessarily semantically appropriate |

**Rule `TONE_EXPRESSIVENESS`:** Use an audio-capable model to look for limited expressive change or a possible mismatch with the passage. Present it tentatively when intention is unclear. “This welcome sounds restrained; try a warmer delivery” is more defensible than “You are sad.”

The coach prompts anger, happiness, surprise, and disgust within a romantic passage. Therefore **do not label the entire second performance as the ground-truth emotion appropriate to those words**. This is especially important for the proposed text → expected emotion comparison.

## 5. Pause — 06:28

Source: [06-Pause.mp4](../videos/06-Pause.mp4).

| Time | What the lesson covers | MVP interpretation |
|---|---|---|
| 00:32–01:20 | Pause to let listeners process complex or important points | Detect likely thought boundaries and whether they have breathing room |
| 01:20–02:44 | Replace unnecessary filler sounds/words with silence | Optional later check: preserve disfluencies before counting them |
| 02:44–03:19 | Pause to breathe and sustain projection through sentence endings | Combine pause evidence with repeated level decay |
| 03:19–03:58 | Pauses invite dialogue and questions | In a solo clip, suggest an opportunity; do not claim the listener wanted to interrupt |
| 04:08–04:23; 04:34–05:02 | Student delivers a dramatic script with more pauses | Useful illustration; the second take contains spoken coach prompts |

**Rule `PAUSE_PROCESSING`:** Suggest a brief pause after a clear key point or complex idea when speech runs straight into the next thought. Do not insert a pause after every punctuation mark or treat every silence as an error.

**Rule `PAUSE_FILLERS` (defer unless verified):** Coach replacing distracting filler clusters with pauses. The recognizer may omit “um” and other sounds; a clean transcript cannot prove their absence. Some words such as “like” are semantically necessary. This feature is not needed to prove the requested rate/volume/tonality MVP.

## 6. What was actually tested

All transcription and acoustic processing ran locally on the available Apple Silicon machine. No coaching video was uploaded to a commercial analysis API for this research. A model was downloaded for local transcription. Hosted providers were researched through their public documentation, not benchmarked here.

| Probe | Result | What it supports |
|---|---|---|
| Coach's slow rate demonstration, 00:29.63–00:39.65 | 12 recognized words in 10.02 s: **71.9 WPM** | Deliberate rate contrast is measurable |
| Coach's fast rate demonstration, 01:07.99–01:14.85 | 50 recognized words in 6.86 s: **437.3 WPM** | The system can localize an extreme rate change; the exact value depends on ASR and boundaries |
| Coach's stronger volume, 00:44.43–01:11.39 | Median voiced-window RMS **−27.65 dBFS** | Provides a within-recording reference |
| Coach's quiet volume, 01:21.35–01:39.59 | Median voiced-window RMS **−34.37 dBFS** | Approximately **6.72 dB lower** recorded level in the quiet example |
| Pitch exercise: first vs second student passage | Raw P10–P90 ranges **14.04 vs 26.10 semitones** | A measurable contrast, but coach interjections and possible tracking errors make this unsuitable as a clean student-only result |
| Pause example: first vs second student passage | ASR reports **0 vs 4 word gaps over 0.5 s** | A directionally plausible signal; the first alignment makes every adjacent word touch, exposing why acoustic VAD/alignment verification is needed |

Rate values include pauses. Level values are the median of 40 ms RMS windows at pitch-voiced frame centers; they are a simple signal proxy, not calibrated room loudness. Pitch analysis used a fixed 65–600 Hz range with a 10 ms step for this probe. These parameters are not validated defaults for every voice.

The courses are edited and demonstrations are not controlled experiments. In particular, the second pitch and pause clips contain another speaker, and the student rate examples have different content. The probe establishes that useful features can be extracted from these files. It does **not** establish reliable automated judgments of good delivery, correct emotional interpretation, causal benefits, or production latency.

## 7. Reproduce and inspect

From the repository root:

```sh
python3 -m venv /tmp/speechapp-research-venv
/tmp/speechapp-research-venv/bin/pip install -r requirements-research.txt
/tmp/speechapp-research-venv/bin/python scripts/research_probe.py
```

The script reuses existing transcript JSON, or downloads and runs `small.en` locally when needed. It writes transcripts and the probe results under `videos/.research/`, which is ignored by the existing `videos/` rule. The versions used are pinned in `requirements-research.txt`; this is a research environment, not a production dependency lock.

Local artifacts generated during this review:

- `videos/.research/transcripts/`: complete automatic transcripts and word-timing JSON for all five videos.
- `videos/.research/*-contact.jpg`: nine sampled visual frames per lesson.
- `videos/.research/probe-results.json`: the numerical probe output and limitations.

The reproducible script regenerates transcripts and metrics. The contact sheets were produced separately by extracting nine evenly spaced frames with FFmpeg and arranging them with Pillow. Full transcripts and course media are kept out of tracked documentation; the tracked notes contain lesson summaries and navigation references.

Return to [MVP research and implementation plan](mvp-research.md).
