import { transcribe, wordsFromDeepgram } from "@micmane/vocal-processing/deepgram"
import { alignWords, loadAligner, type Aligner } from "@micmane/vocal-processing/align"
import { openaiCompletion, tonalitySettings } from "@micmane/vocal-processing/openai"
import { predictPacing } from "@micmane/vocal-processing/pacing"
import { findPauses, type Pause } from "@micmane/vocal-processing/pauses"
import { detectRate, syllables, RATE_VERSION, type RateMark } from "@micmane/vocal-processing/rate"
import { PAUSE_VERSION, type PauseMark } from "@micmane/vocal-processing/pause"
import { reviewPause } from "@micmane/vocal-processing/pause-review"
import { detectVolume, VOLUME_VERSION, type VolumeMark } from "@micmane/vocal-processing/volume"
import { geminiVoice } from "@micmane/vocal-processing/gemini"
import { reviewTonality, tonalityConfig, TONALITY_VERSION, type Emotion, type ToneMark } from "@micmane/vocal-processing/tonality"
import { decodeAudio } from "./audio.ts"

type Word = { text: string; start: number; end: number }
type Segment = { id: string; start: number; end: number; text: string; words: Word[]; speakingRate: number }

export function segmentWords(words: Word[]): Segment[] {
  const segments: Segment[] = []
  let current: Word[] = []
  const flush = () => {
    if (!current.length) return
    const first = current[0]
    const last = current[current.length - 1]
    const seconds = Math.max(last.end - first.start, 0.1)
    segments.push({
      id: `segment-${segments.length + 1}`,
      start: first.start,
      end: last.end,
      text: current.map((word) => word.text).join(" "),
      words: current,
      speakingRate: current.reduce((sum, word) => sum + syllables(word.text), 0) / seconds,
    })
    current = []
  }
  for (const word of words) {
    if (current.length && (word.start - current[current.length - 1].end >= 0.5 || current.length >= 25)) flush()
    current.push(word)
    if (/[.!?]$/.test(word.text)) flush()
  }
  flush()
  return segments
}

const copy = {
  // A passage whose key points went by no slower than its setup.
  RATE_CONTRAST: {
    observation: "Your key points go by as fast as the setup around them.",
    why_it_matters: "Slowing down on what matters tells the listener what to focus on.",
    practice: "Slow down on the point, then move through the setup.",
  },
  RATE_IMPORTANCE_FAST: {
    observation: "This passage moves quickly.",
    why_it_matters: "A little more time can make this passage easier to follow.",
    practice: "Give this phrase a little more time, then resume your natural pace.",
  },
  RATE_IMPORTANCE_SLOW: {
    observation: "This passage moves slowly.",
    why_it_matters: "A brisker pace can help this passage keep its momentum.",
    practice: "Move through this phrase more briskly and save time for the key idea.",
  },
} as const
const pauseCopy = {
  PAUSE_NECESSARY: {
    observation: "This stretch runs on without a pause.",
    why_it_matters: "A pause gives the listener a moment to take in what you just said.",
    practice: "Stop at the marked place and let the point land before you go on.",
  },
  PAUSE_TOO_SHORT: {
    observation: "This moment passes too quickly.",
    why_it_matters: "The point needs a moment to sink in before you move on.",
    practice: "Hold the marked pause longer and let the point land.",
  },
  PAUSE_UNNECESSARY: {
    observation: "The pauses here break up the thought.",
    why_it_matters: "Stopping every few words makes one idea hard to follow.",
    practice: "Say this thought in one breath, without stopping at the marked places.",
  },
  PAUSE_TOO_LONG: {
    observation: "This silence goes on too long.",
    why_it_matters: "A silence this long stops sounding deliberate, and the listener starts to wonder if you lost your place.",
    practice: "Keep the pause, but move on after a beat or two.",
  },
} as const
const volumeCopy = {
  // A stretch whose voice turned softer and duller than the speaker's normal.
  VOLUME_LOW: {
    observation: "Your voice drops here and loses its projection.",
    why_it_matters: "Volume carries confidence and energy; when it drops, listeners have to work to stay with you.",
    practice: "Keep the volume you use elsewhere through this stretch, about a 6 or 7 out of 10.",
  },
  // Phrase endings that repeatedly drop well below the speaker's normal.
  VOLUME_FADE: {
    observation: "Your voice trails off at the end of these sentences.",
    why_it_matters: "The end of a sentence often carries the point; when it fades, it gets lost.",
    practice: "Take a breath at the pause before, and carry your volume through to the last word.",
  },
} as const

// Vinh's tonality lesson: the face is the remote control for the emotion in the voice.
const toneCopy = {
  TONE_FLAT: {
    observation: "Your voice sounds flat here.",
    why_it_matters: "Listeners connect with the feeling in your voice, not only with the words.",
    practice: "Decide what this passage should feel like, let your face show it, and say it again.",
  },
} as const

/** How a tonality note names the feeling the words call for. */
const FEELING: Record<Emotion, string> = {
  happy: "warmth or enthusiasm", sad: "concern", angry: "conviction", surprised: "curiosity",
  fearful: "urgency", disgusted: "disapproval", neutral: "a calm voice",
}

export function flatObservation(expected: Emotion[]): string {
  const feelings = expected.filter(e => e !== "neutral").slice(0, 2).map(e => FEELING[e])
  return feelings.length ? `Your voice sounds flat here, while the words call for ${feelings.join(" and ")}.` : toneCopy.TONE_FLAT.observation
}

/** One finding per segment a mark covers; the shared group ID lets the app rejoin them into one highlight. */
function findingsFor<R extends string>(segments: Segment[], marks: { start: number; end: number; rule: R; suggestions?: RateMark["suggestions"] }[], text: Record<R, { observation: string; why_it_matters: string; practice: string }>) {
  return marks.flatMap((mark, markIndex) => segments.flatMap(segment => {
    const covered = segment.words.filter(word => word.start >= mark.start && word.end <= mark.end)
    if (!covered.length) return []
    const phrase = covered.map(word => word.text).join(" ")
    return [{
      segment_id: segment.id, group_id: String(markIndex), rule_id: mark.rule, kind: "improvement", uncertainty: "tentative",
      ...text[mark.rule],
      start: covered[0].start, end: covered[covered.length - 1].end, text: phrase,
      // Every part of a passage carries its suggestions; the editor keeps them when it rejoins the parts.
      ...(mark.suggestions?.length ? { suggestions: mark.suggestions.map(({ direction, start, end, text }) => ({ direction, start, end, text })) } : {}),
    }]
  }))
}

/**
 * Pauses are judged only with pauses measured from the audio and a model
 * review; otherwise they are not assessed. Each finding names its words.
 */
export function pauseAssessment(segments: Segment[], marks: PauseMark[] | undefined, words: Word[] = []) {
  const findings = findingsFor(segments, marks ?? [], pauseCopy).map(f => {
    const mark = marks![Number(f.group_id)]
    const direction = ({ PAUSE_NECESSARY: "pause_after", PAUSE_TOO_SHORT: "lengthen_pause_after", PAUSE_UNNECESSARY: "no_pause_after", PAUSE_TOO_LONG: "shorten_pause_after" } as const)[mark.rule]
    const suggestions = mark.at.map(i => words[i]).filter(w => w && w.start >= f.start && w.end <= f.end).map(w => ({ direction, start: w.start, end: w.end, text: w.text }))
    return { ...f, uncertainty: "clear", suggestions }
  })
  return {
    foundation: "pauses" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summary: !marks ? "Pauses could not be assessed for this take." : marks.length ? "Some pauses are missing, out of place, too short or too long." : "No pause issue was detected in this take.",
    findings,
  }
}

/**
 * Volume is judged against the speaker's own level in the recording, so it
 * needs the decoded audio; otherwise it is not assessed.
 */
export function volumeAssessment(segments: Segment[], marks: VolumeMark[] | undefined) {
  return {
    foundation: "volume" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summary: !marks ? "There is not enough clear speech to judge volume in this take." : marks.length ? "Your voice drops or trails off in a few places." : "No drop in volume or trailing off was detected in this take.",
    findings: findingsFor(segments, marks ?? [], volumeCopy),
  }
}

/**
 * Volume uses the recognizer's word timing, as its benchmark does: forced
 * alignment refines words against measured pauses and trims a fading voice
 * as if it were silence. Alignment keeps the same words in the same order, so
 * the marks are moved onto the aligned transcript the segments are built from.
 */
export function measureVolume(samples: Float32Array, sampleRate: number, recognized: Word[], transcript: Word[]): VolumeMark[] | undefined {
  const volume = detectVolume(samples, sampleRate, recognized)
  return volume.reliable ? volume.marks.map(m => ({ ...m, start: transcript[m.first].start, end: transcript[m.last].end })) : undefined
}

/** Tonality is judged only when Gemini and the text model both answered; otherwise it is not assessed. */
export function tonalityAssessment(segments: Segment[], marks: ToneMark[] | undefined) {
  const findings = findingsFor(segments, marks ?? [], toneCopy).map(f => ({ ...f, observation: flatObservation(marks![Number(f.group_id)].expected) }))
  return {
    foundation: "tonality" as const,
    verdict: !marks ? "uncertain" : marks.length ? "mixed" : "effective",
    summary: !marks ? "Tonality could not be assessed for this take." : marks.length ? "Your voice sounds flat in places; a little more feeling would help the words land." : "No flat stretch was detected; your voice carries some expression.",
    findings,
  }
}

export function rateReview(segments: Segment[], marks: RateMark[], message = "", status: "reviewed" | "uncertain" = "reviewed") {
  const findings = findingsFor(segments, marks, copy)
  return {
    overall: message ? `Your main message: ${message}` : "Review your rate of speech.",
    assessments: [
      { foundation: "rate", verdict: marks.length ? "mixed" : status === "uncertain" ? "uncertain" : "effective", summary: marks.length ? "There are a few places where a pace change may help the point land." : status === "uncertain" ? "There is not enough reliable evidence to judge the rate in this take." : "No substantial rate issue was detected in this take.", findings },
      ...(["volume", "pitch_melody", "tonality", "pauses"] as const).map((foundation) => ({ foundation, verdict: "uncertain", summary: "This foundation has not been analyzed yet.", findings: [] })),
    ],
  }
}

/** The decoded audio and its measured pauses, since recognizers stretch words over them; undefined if it can't be decoded. */
async function measurePauses(audio: Uint8Array): Promise<{ samples: Float32Array; sampleRate: number; pauses: Pause[] } | undefined> {
  try {
    const { samples, sampleRate } = await decodeAudio(audio)
    return { samples, sampleRate, pauses: findPauses(samples, sampleRate) }
  } catch {
    return undefined
  }
}

// How expressive the voice sounds per passage, compared with the feeling the words call for.
async function analyzeTonality(words: Word[], decoded: { samples: Float32Array; sampleRate: number }) {
  try {
    return await reviewTonality(words, decoded.samples, decoded.sampleRate, geminiVoice(), openaiCompletion(tonalitySettings()), tonalityConfig())
  } catch {
    return undefined
  }
}

// Refine recognizer timing before measuring speaking time.
let aligner: Promise<Aligner> | undefined
async function retime(words: Word[], decoded: { samples: Float32Array; pauses: Pause[] } | undefined): Promise<Word[]> {
  if (process.env.ALIGN_WORDS === "0" || !decoded) return words
  try {
    aligner ??= loadAligner()
    return await alignWords(words, decoded.samples, await aligner, decoded.pauses)
  } catch {
    aligner = undefined
    return words
  }
}

export async function reviewAudio(audio: Buffer, audioType: string) {
  const [response, decoded] = await Promise.all([transcribe(new Uint8Array(audio)), measurePauses(audio)])
  const recognized = wordsFromDeepgram(response) as Word[]
  if (recognized.length < 3) return undefined
  // The pacing prediction reads only the text, so it runs while alignment re-times the words.
  const [transcript, pacing] = await Promise.all([retime(recognized, decoded), predictPacing(recognized, openaiCompletion()).catch(() => undefined)])
  const pauses = decoded?.pauses
  const segments = segmentWords(transcript)
  const analysis = detectRate(transcript, {}, pauses, pacing)
  // Without the waveform, silence cannot be told from speech; without the prediction, contrast is unjudged.
  const measured = !!decoded && analysis.reliable
  const status = measured && analysis.contrast ? "reviewed" as const : "uncertain" as const
  const marks = measured ? analysis.marks : []
  // Timing measures every pause; a model judges each one and every stretch without one.
  // Tonality runs alongside: Gemini hears each passage while a text model reads the words.
  const [pause, tone] = await Promise.all([
    pauses ? reviewPause(transcript, pauses, openaiCompletion(), transcript === recognized ? undefined : recognized) : undefined,
    decoded ? analyzeTonality(transcript, decoded) : undefined,
  ])
  const toneMarks = tone?.reliable ? tone.marks : undefined
  const pauseMarks = pause?.reliable ? pause.marks : undefined
  const rate = rateReview(segments, marks, "", status)
  const volumeMarks = decoded && measureVolume(decoded.samples, decoded.sampleRate, recognized, transcript)
  const review = { ...rate, assessments: rate.assessments.map(a => a.foundation === "pauses" ? pauseAssessment(segments, pauseMarks, transcript) : a.foundation === "volume" ? volumeAssessment(segments, volumeMarks) : a.foundation === "tonality" ? tonalityAssessment(segments, toneMarks) : a) }
  return {
    audio: audio.toString("base64"),
    audioType,
    segments,
    rateDiagnostics: { version: RATE_VERSION, status, pace: analysis.pace, articulationRate: analysis.articulationRate, pacing, marks },
    pauseDiagnostics: { version: PAUSE_VERSION, status: pauseMarks ? "reviewed" as const : "uncertain" as const, review: pause?.status, pauses, marks: pauseMarks ?? [] },
    volumeDiagnostics: { version: VOLUME_VERSION, status: volumeMarks ? "reviewed" as const : "uncertain" as const, marks: volumeMarks ?? [] },
    tonalityDiagnostics: { version: TONALITY_VERSION, status: toneMarks ? "reviewed" as const : "uncertain" as const, passages: tone?.passages, marks: toneMarks ?? [] },
    review,
  }
}
