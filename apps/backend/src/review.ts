import { transcribe, wordsFromDeepgram } from "@micmane/vocal-processing/deepgram"
import { analyzeSpeech } from "@micmane/vocal-processing/analysis"
import { openaiCompletion } from "@micmane/vocal-processing/openai"
import type { RateMark } from "@micmane/vocal-processing/rate"
import type { PauseMark, PauseResult } from "@micmane/vocal-processing/pauses"

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
  PAUSE_NECESSARY: {
    observation: "This thought runs into the next without much space.",
    why_it_matters: "A short pause can give the listener time to process the point.",
    practice: "Leave a short silent pause at the marked boundary before continuing.",
  },
  PAUSE_UNNECESSARY: {
    observation: "This gap interrupts the flow of the thought.",
    why_it_matters: "The separation can make connected ideas harder to follow.",
    practice: "Shorten this pause and keep the connected words flowing.",
  },
  PAUSE_FILLERS: {
    observation: "These words appear to be a filler or an abandoned start.",
    why_it_matters: "A silent pause can make the next thought easier to follow.",
    practice: "Replace the highlighted filler with a brief silent pause, then continue.",
  },
} as const

export function deliveryReview(segments: Segment[], marks: RateMark[], pauses: PauseResult, message: string) {
  type Rule = RateMark["rule"] | PauseMark["rule"]
  type Note = { mark: RateMark | PauseMark; foundation: "rate" | "pauses"; rules: Rule[]; practice: string; impact: number }
  const notes: Note[] = pauses.marks.map((mark) => ({ mark, foundation: "pauses", rules: [mark.rule], practice: copy[mark.rule].practice, impact: mark.impact }))
  const overlaps = (a: { first: number; last: number }, b: { first: number; last: number }) => a.first <= b.last && b.first <= a.last
  // Preserve both rule IDs when one replay/practice exercise covers the problem.
  for (const note of [...notes]) {
    if (note.mark.rule !== "PAUSE_UNNECESSARY") continue
    const filler = notes.find((n) => n.mark.rule === "PAUSE_FILLERS" && overlaps(n.mark, note.mark))
    if (filler) {
      filler.rules.push("PAUSE_UNNECESSARY")
      filler.practice = "Replace the highlighted filler with a brief silent pause and shorten the hesitation before continuing."
      filler.impact = Math.max(filler.impact, note.impact)
      notes.splice(notes.indexOf(note), 1)
    }
  }
  for (const mark of marks) {
    const pause = mark.rule === "RATE_IMPORTANCE_FAST" && notes.find((n) => n.mark.rule === "PAUSE_NECESSARY" && n.mark.first >= mark.first && n.mark.first <= mark.last)
    if (pause) {
      pause.rules.push(mark.rule)
      pause.practice = "Give the key phrase a little more time and leave a short silent pause at the marked boundary."
      pause.impact = Math.max(pause.impact, mark.impact)
    } else notes.push({ mark, foundation: "rate", rules: [mark.rule], practice: copy[mark.rule].practice, impact: mark.impact })
  }
  const words = segments.flatMap((s) => s.words)
  const findings = notes.sort((a, b) => b.impact - a.impact).slice(0, 3).flatMap(({ mark, foundation, rules, practice }) => {
    const first = words[mark.first], last = words[mark.last]
    const segment = segments.find((part) => part.words.includes(first))
    return segment && first && last ? [{ foundation, segment_id: segment.id, rule_id: mark.rule,
      related_rule_ids: rules.filter((rule) => rule !== mark.rule), at: "at" in mark ? mark.at : mark.start,
      span: [first.start, last.start], kind: "improvement", uncertainty: "tentative", ...copy[mark.rule], practice }] : []
  })
  const pauseIssues = pauses.candidates.length > 0
  return {
    overall: message ? `Your main message: ${message}` : "Review your pace and pauses around the main point.",
    assessments: [
      { foundation: "rate", verdict: marks.length ? "mixed" : "effective", summary: marks.length ? "A pace change may help the point land; related advice may appear in a pause note." : "No substantial rate issue was detected in this take.", findings: findings.filter((f) => f.foundation === "rate") },
      { foundation: "pauses", verdict: pauseIssues ? "mixed" : "uncertain",
        summary: pauseIssues ? "There are places where a pause change or replacing filler with silence may help."
          : pauses.assessedBoundaries ? "No substantial pause issue was detected from the transcript and estimated gaps."
          : "There is not enough contextual evidence to judge pause placement.", findings: findings.filter((f) => f.foundation === "pauses") },
      ...(["volume", "pitch_melody", "tonality"] as const).map((foundation) => ({ foundation, verdict: "uncertain", summary: "This foundation has not been analyzed yet.", findings: [] })),
    ],
  }
}

export async function reviewAudio(audio: Buffer, audioType: string) {
  const transcript = wordsFromDeepgram(await transcribe(new Uint8Array(audio))) as Word[]
  if (transcript.length < 3) return undefined
  const segments = segmentWords(transcript)
  const { labeled, rate, pauses } = await analyzeSpeech(transcript, openaiCompletion())
  return {
    audio: audio.toString("base64"),
    audioType,
    segments,
    pauses: pauses.gaps.map(({ start, end }) => ({ start, end })),
    review: deliveryReview(segments, rate.marks, pauses, labeled.message.message),
  }
}
