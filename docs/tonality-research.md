# Tonality: what can be heard, and which tools hear it

Measured on 1–2 October 2026. The detector this led to is described in the [README](../README.md#tonality). Sections 1–3 compare tools; section 4 tests the emotion2vec+ design built first, and section 5 the Gemini design that replaced it.

## 1. Vinh's bad-tonality examples

The Tonality lesson ([05-Tonality.mp4](../videos/05-Tonality.mp4)) demonstrates three bad deliveries:

| Time | Demonstration | Audible? |
|---|---|---|
| 1:18 | "Good morning, everyone" with a sad face | Yes: pitch at 92 Hz (his teaching is 130–175), 2.5 semitones of movement, about 12 dB quieter |
| 1:38 | "Good morning, everyone" with a disgusted face | Not by any method tried: it reads as raised and positive |
| 2:30–2:55 | "Blank face Vinh", the lesson's main problem | No, see below |

The student's romantic passage (3:38–4:47) is another speaker, and Vinh calls emotions out over the second take, so it was excluded.

### The blank face is mostly visible

Every measure put the blank-face demonstration inside his normal teaching range:

| Measure | Blank face | His teaching (6 excerpts) |
|---|---|---|
| Pitch movement, 10th–90th percentile | 11.2 semitones | 10.7–14.8 |
| Loudness range | 14.5 dB | 13.3–15.8 |
| Spectral tilt (alpha ratio) | −12.7 dB | −12.7 to −17.1 |
| Harmonics-to-noise ratio | 10.4 dB | 9.5–12.3 |
| Arousal, audEERING emotion model | 0.69 | 0.51–0.79 |

In 3 s windows its level is about 3 dB lower and its pitch slightly lower than the speech around it, but both overlap his normal variation. A rule that caught it would also flag his teaching.

## 2. Tools

| Tool | Kind | Status in 2026 |
|---|---|---|
| Hume Expression Measurement | Prosody API, 48 emotion dimensions | Standalone API closed in May–June 2026; now only inside Hume's voice agent ([audEERING](https://www.audeering.com/after-humes-expression-measurement-api-what-matters/), [Hume](https://www.hume.ai/expression-measurement-api)) |
| audEERING devAIce | Commercial SDK | Sales contact only |
| [audEERING wav2vec2 MSP-Podcast](https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim) | Open model: arousal, dominance, valence | Research only (CC BY-NC-SA 4.0); commercial licence through audEERING |
| [emotion2vec+ large](https://huggingface.co/emotion2vec/emotion2vec_plus_large) | Open model: 9 emotions | [FunASR Model Open Source License 1.1](https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE): use, modification and redistribution allowed with attribution |
| [SenseVoice](https://github.com/QwenAudio/SenseVoice) | ASR with emotion tags | Not tested |
| OpenAI `gpt-audio-1.5`, Mistral Voxtral Small | Audio language models | Tested below |
| Gemini 3.5 Flash, 3.1 Pro | Audio language models | Tested in section 5; Gemini 2.5 and Qwen3-Omni (30B) not tested |

Gemini 2.5 leads recent audio-emotion benchmarks ([AHELM](https://arxiv.org/pdf/2508.21376), [HumDial-EIBench](https://arxiv.org/html/2604.11594v1)). However, a controlled study of six audio language models, including Gemini 2.5 Pro and Qwen3-Omni, found that they largely "transcribe rather than listen": when only the voice carries the emotion, they perform near chance ([LISTEN, EACL 2026](https://aclanthology.org/2026.eacl-long.274.pdf)). Pairwise judging is an option, but language-model judges still trail people on paralinguistic comparisons ([ParaPairAudioBench](https://arxiv.org/abs/2606.24648)).

## 3. Comparison on a fixed panel

88 clips were chosen before any method ran on them: 15 s at random from Vinh's three lessons (demonstrations and music avoided), the blank-face and greeting demonstrations, two clips from each of your 22 talks, six from the retake, the 14 voice-pack takes and the course student. Each method gave every clip a score; the language models were run three times. The models were asked how emotionally expressive the voice sounds, from 1 (flat, blank) to 5 (vivid). They were not told who was speaking or what to expect.

Separation is the probability that the more expressive item scores higher (0.5 is chance). Within-speaker comparisons control for the voice and microphone; Vinh against your talks does not.

| Method | Your good take vs flat take | Retake over your talks | Vinh teaching over blank face | Vinh over your talks (confounded) |
|---|---|---|---|---|
| **Pitch movement** (this detector's measure) | 8.0 vs 3.5 | **0.70** | 0.50 | 0.84 |
| audEERING arousal | 0.44 vs 0.21 | 0.58 | 0.67 | 0.97 |
| emotion2vec+, 1 − P(neutral) | 0.99 vs 0.07 ‡ | 0.55 | 0.67 | 0.72 |
| gpt-audio-1.5 | 2.3 vs 2.0 | 0.68 | 1.00 † | 0.97 |
| gpt-audio-1.5, words filtered out | 3.7 vs 3.3 | 0.33 | 0.32 | 0.54 |
| Voxtral Small | 3.0 vs 3.0 | 0.44 | 1.00 † | 0.78 |

‡ An artifact: the good take scored 95% on the model's "unknown" class, not on an emotion. Renormalized over the seven emotions, both takes are neutral.

† The blank-face words say "I don't have much emotion". With the words filtered out (400 Hz low-pass), the same model scores 0.32, so the 1.00 comes from the words.

Agreement between methods on your own 64 clips (rank correlation) is weak everywhere. Pitch movement agrees most with the others: 0.46 with arousal and 0.41 with gpt-audio. All other pairs are between −0.17 and 0.26. The language models gave the same score in all three runs on 62% (gpt-audio) and 71% (Voxtral) of clips.

## 4. The emotion2vec+ design

Built as described in the README: emotion2vec+ hears whether each passage's voice is neutral, a text model lists the emotions the words call for, and a passage is flagged when the voice is neutral where the words call for feeling. It was run on the development clips and on held-out recordings: Vinh's three lessons, your 22 talks, your retake and the course student.

**Only the flat-vs-feeling axis is usable.** Two rules were compared on the same results, as the share of speaking time flagged:

| Rule | Vinh, held-out lessons | Your talks | Your retake |
|---|---|---|---|
| Voice not in an emotion the words call for, sentence passages | 51–54% | 52–53% | 41–48% |
| Flat voice where the words call for feeling, sentence passages | 34–37% | 43–44% | 35–42% |
| **Flat voice where the words call for feeling, 10–30 s passages** | **18%** | **29%** | **29%** |

On sentences, the model heard Vinh as neutral 49–53% of the time; on 10–30 s passages, 32%. The flags left in Vinh's lessons include a student's monologue and a passage with music, but several are his upbeat teaching heard as neutral.

**The text model is fairly stable.** Calm is allowed in 38% of passages, and two independent runs give the same answer for 92% of them. The same paragraph can still flip: your two readings got "angry, surprised" and "neutral, sad".

**The ONNX export is exact.** The full-precision export matches PyTorch to within 0.00002 on 88 clips. The smaller emotion2vec+ base model can't be used: it hears all of Vinh's teaching as neutral.

## 5. Gemini as the ear

Hume's [RW-Voice-EQ](https://www.hume.ai/rw-voice-eq) benchmark (real-world speech, 2026) ranks Gemini 3.1 Pro (0.647) and Gemini 3.5 Flash (0.620) first for speech emotion, ahead of GPT Audio (0.530). It also finds that comparing two clips is much easier than labeling one (about 88% against 23%), and that people agree only moderately on expressiveness (r ≈ 0.47 with the words, 0.25 without). Gemini 3.5 Flash was tested with the same 1–5 prompt as section 3, on a cost-trimmed panel (six of Vinh's clips, one clip per talk, the voice pack, retake, demonstrations and student), always with a words-filtered control.

**Pairs.** Each pair was asked in both orders to cancel position bias.

| Pair | Unfiltered | Words filtered |
|---|---|---|
| Your expressive reading over your flat one (same words) | 5/6 | 4/4 |
| The flat reading against itself (control) | "same" 6/6 | — |
| Vinh teaching over his blank face | 12/12 | 3/8 |
| Your melodic reading over your monotone one (a pitch contrast) | 5/6 | 2/4 |
| Vinh's student, after coaching over before | 1/6 | 0/4 |

The blank-face result comes from its words, as with gpt-audio. The student's "before" take is the more animated one, so that pair says little.

**Single clips (1–5, mean).**

| Group | Unfiltered | Words filtered |
|---|---|---|
| Vinh teaching | 4.42 | 3.17 |
| Vinh's blank face | 2.0 | 3.5 |
| Your talks | 2.39 | 1.77 |
| Your retake | 2.75 | 1.83 |
| Voice pack | 1.82 | — |

Vinh over your talks separates perfectly with and without the words (1.00). Unlike gpt-audio and Voxtral, Gemini keeps this with the words filtered out, so it hears the voice. Ratings are coarse: your expressive reading scores 2 on its own, and the retake is about level with the talks. 72% of clips got the same score in both runs.

**In the pipeline (flat = 1–2).** Same passages and text-model fits as section 4, with 141 held-out passages (three per Vinh lesson, five per talk, the rest whole). The share of speaking time flagged:

| | Vinh's lessons | Your talks | Your retake |
|---|---|---|---|
| emotion2vec+ | 21% | 31% | 29% |
| **Gemini 3.5 Flash** | **0%** | **35%** | **33%** |

The two ears barely agree on individual passages (Spearman 0.14). Your expressive reading is unflagged only because the text model said a calm voice suits that paragraph; your flat reading is flagged.

**Gemini 3.1 Pro.** It got the pair right 6/6 (control "same" 6/6) and rated the expressive reading 3 against 1.5 for the flat one on single clips. But it rated your talks higher than Flash did (so it would flag less), gave the same score in both runs on only 43% of clips, and costs a little more. Flash and Pro rank clips similarly (0.73). Flash was chosen for its consistency: the same take uploaded twice should get similar feedback.

**Cost.** One 10–30 s rating costs about $0.0035 with Flash (audio is 32 tokens per second; output, including thinking, averaged 238 tokens). All of these tests cost about $1.10.

## 6. Conclusions

- **Most audio language models are not tonality judges.** gpt-audio and Voxtral follow the words, rarely separate the readings, and change their answers between runs. **Gemini 3.5 Flash is the exception tested here:** with the words filtered out, it still separates Vinh from you and your two readings. It now hears the voice in the detector.
- **emotion2vec+ gave a real but weak signal** and could not hear degrees of expressiveness in ordinary speech: it rated your expressive reading 100% neutral.
- **Single-passage verdicts stay noisy.** Gemini's 1–5 ratings are coarse, and comparing two takes is more reliable than rating one. A future "compare with your last take" feature could use that.
- **Pitch movement** separated flat and expressive readings well, but it belongs to the Pitch & Melody fundamental.
- **Partial agreement is the realistic target.** Delivery has many valid readings, and even people agree only moderately on expressiveness. A perfect benchmark score would point to leakage or overfitting.
