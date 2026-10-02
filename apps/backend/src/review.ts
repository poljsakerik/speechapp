import { transcribe, wordsFromDeepgram } from "@micmane/vocal-processing/deepgram"
import { alignWords, loadAligner, type Aligner } from "@micmane/vocal-processing/align"
import { openaiCompletion } from "@micmane/vocal-processing/openai"
import { predictPacing } from "@micmane/vocal-processing/pacing"
import { findPauses, type Pause } from "@micmane/vocal-processing/pauses"
import { detectRate, syllables, RATE_VERSION, type RateMark } from "@micmane/vocal-processing/rate"
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

export function rateReview(segments: Segment[], marks: RateMark[], message = "", status: "reviewed" | "uncertain" = "reviewed") {
  const findings = marks.flatMap((mark, markIndex) => segments.flatMap(segment => {
    const covered = segment.words.filter(word => word.start >= mark.start && word.end <= mark.end)
    if (!covered.length) return []
    const phrase = covered.map(word => word.text).join(" ")
    return [{
      segment_id: segment.id, group_id: String(markIndex), rule_id: mark.rule, kind: "improvement", uncertainty: "tentative",
      ...copy[mark.rule],
      start: covered[0].start, end: covered[covered.length - 1].end, text: phrase,
      // Every part of a passage carries its suggestions; the editor keeps them when it rejoins the parts.
      ...(mark.suggestions?.length ? { suggestions: mark.suggestions.map(({ direction, start, end, text }) => ({ direction, start, end, text })) } : {}),
    }]
  }))
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
  return {
    audio: audio.toString("base64"),
    audioType,
    segments,
    rateDiagnostics: { version: RATE_VERSION, status, pace: analysis.pace, articulationRate: analysis.articulationRate, pacing, marks },
    review: rateReview(segments, marks, "", status),
  }
}
