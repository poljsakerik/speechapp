import { transcribe, wordsFromDeepgram } from "@micmane/vocal-processing/deepgram"
import { markMessage } from "@micmane/vocal-processing/importance"
import { openaiCompletion } from "@micmane/vocal-processing/openai"
import { detectRate, type RateMark } from "@micmane/vocal-processing/rate"

type Word = { text: string; start: number; end: number }
type Segment = { id: string; start: number; end: number; text: string; words: Word[]; wpm: number }

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
      wpm: Math.round(current.length * 60 / seconds),
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
  RATE_IMPORTANCE_FAST: {
    observation: "This point passed quickly.",
    why_it_matters: "The listener may miss a point that carries your message.",
    practice: "Give this phrase a little more time, then resume your natural pace.",
  },
  RATE_IMPORTANCE_SLOW: {
    observation: "This setup took more time than the point needs.",
    why_it_matters: "The pacing can draw attention away from your main point.",
    practice: "Move through this phrase more briskly and save time for the key idea.",
  },
  RATE_MONOTONE: {
    observation: "The pace stayed similar through this stretch.",
    why_it_matters: "A change of pace can help the main point stand out.",
    practice: "Slow down on the key phrase and move faster through the setup.",
  },
} as const

export function rateReview(segments: Segment[], marks: RateMark[], message: string) {
  const findings = marks.flatMap((mark) => {
    const segment = segments.find((part) => part.start <= mark.start && part.end >= mark.start)
      ?? segments.find((part) => part.start < mark.end && part.end > mark.start)
    if (!segment) return []
    const suggestions = [
      ...(mark.slowDown ? [{ direction: "slow_down", start: mark.slowDown.start, end: mark.slowDown.end, text: mark.slowDown.text }] : []),
      ...(mark.speedUp ? [{ direction: "speed_up", start: mark.speedUp.start, end: mark.speedUp.end, text: mark.speedUp.text }] : []),
    ]
    return [{
      segment_id: segment.id,
      rule_id: mark.rule,
      kind: "improvement",
      uncertainty: "tentative",
      start: mark.start,
      end: mark.end,
      text: mark.text,
      ...copy[mark.rule],
      ...(suggestions.length ? { suggestions } : {}),
    }]
  })
  return {
    overall: message ? `Your main message: ${message}` : "Review your pace around the main point.",
    assessments: [
      { foundation: "rate", verdict: marks.length ? "mixed" : "effective", summary: marks.length ? "There are a few places where a pace change may help the point land." : "No substantial rate issue was detected in this take.", findings },
      ...(["volume", "pitch_melody", "tonality", "pauses"] as const).map((foundation) => ({ foundation, verdict: "uncertain", summary: "This foundation has not been analyzed yet.", findings: [] })),
    ],
  }
}

export async function reviewAudio(audio: Buffer, audioType: string) {
  const transcript = wordsFromDeepgram(await transcribe(new Uint8Array(audio))) as Word[]
  if (transcript.length < 3) return undefined
  const segments = segmentWords(transcript)
  const labeled = await markMessage(transcript, { complete: openaiCompletion() })
  const result = detectRate(labeled.words)
  return {
    audio: audio.toString("base64"),
    audioType,
    segments,
    review: rateReview(segments, result.marks, labeled.message.message),
  }
}
