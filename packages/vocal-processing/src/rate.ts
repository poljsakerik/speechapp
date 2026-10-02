/**
 * Rate of speech: how fast the words themselves are spoken, and whether the
 * pace follows the meaning.
 *
 * Rate is articulation rate: speech per second of actual speaking, with pauses
 * left out. Listeners judge speed mostly from articulation, and pausing is a
 * separate fundamental, so no pause decides a rate finding.
 *
 * Two checks:
 * - Contrast (the everyday one). Skilled speakers slow down on the point and
 *   move through the setup. Given a text-based prediction of which phrases
 *   deserve which (pacing.ts), a passage is flagged when its key phrases were
 *   not slower than its setup phrases at all. Pace is measured against the
 *   speaker's own normal, so it works for fast and slow talkers alike. Single
 *   phrases are too noisy to judge; a passage of about 30 s is not. On held-out
 *   recordings this flagged 15-25% of the course coach's passages and about
 *   half of untrained talks'.
 * - Sustained speed, for the obvious cases: 15 s of speaking (or the whole
 *   clip) at 8 syllables/s or more, or 3 or less. Everyday speech from four
 *   speakers stayed between 3.3 and 7.0.
 */
import { measurePace, mergePauses, silenceBetween, type PaceProfile } from "./pace.ts"
import type { PacingPrediction } from "./pacing.ts"
import { pronunciation } from "./syllables.ts"
import type { Word } from "./types.ts"
import type { Pause } from "./pauses.ts"
export { syllables } from "./syllables.ts"

// Keep the existing speed-action IDs so saved highlights remain readable.
/** A whole stretch too fast or too slow. */
export type SpeedRule = "RATE_IMPORTANCE_FAST" | "RATE_IMPORTANCE_SLOW"
/** RATE_CONTRAST: a passage whose key points were no slower than its setup. */
export type RateRule = SpeedRule | "RATE_CONTRAST"
export type Span = { first: number; last: number; start: number; end: number; text: string }
export type Suggestion = Span & { direction: "slow_down" | "speed_up" }
export type RateMark = Span & {
  rule: RateRule
  /** Syllables per second of speaking over the marked span. */
  articulationRate: number
  /** For contrast marks: the key phrase to slow down on and the setup to move through. */
  suggestions?: Suggestion[]
}
export type RateAnalysis = {
  pace?: PaceProfile; marks: RateMark[]
  speakingRate?: number; articulationRate?: number
  /** False when there is too little usable speech to judge. */
  reliable: boolean
  /**
   * Whether the contrast check judged at least one passage. It needs a pacing
   * prediction and a passage with two or more key and setup phrases.
   */
  contrast: boolean
  /** Measured phrases: predicted score and pace relative to the speaker's own median phrase (log2). */
  phrases: (Span & { score: number; pace: number })[]
  /** Judged passages: mean relative pace of key and setup phrases, and whether the passage was flagged. */
  passages: (Span & { keyPace: number; setupPace: number; flagged: boolean })[]
}
export const RATE_VERSION = 22
/** Rates are syllables/second of speaking; durations are seconds of speaking. */
export const DEFAULT_RATE_CONFIG = {
  passagePhrases: 12, // About 30 s of speech.
  sustainedSeconds: 15, // Or the whole clip, if it has less speech than this.
  minSpeechSeconds: 5, // Less speech than this cannot be judged.
  fastRate: 8,
  slowRate: 3,
  maxSyllableSeconds: 1, // Longer than this is not speech: music or noise the word timing absorbed.
}
export type RateConfig = typeof DEFAULT_RATE_CONFIG

type Timed = Word & { index: number; start: number; end: number }
type Phrase = Span & { score: number; pace: number; from: number; to: number }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function detectRate(words: Word[], config: Partial<RateConfig> = {}, pauses: Pause[] = [], pacing?: PacingPrediction): RateAnalysis {
  const c = { ...DEFAULT_RATE_CONFIG, ...config }
  const ws = words.map((w, index) => ({ ...w, index })).filter((w): w is Timed =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start! >= 0 && w.end! > w.start!)
  if (ws.length < 2 || ws.length !== words.length || ws.some((w, i) => i && w.start < ws[i - 1].start)) return { marks: [], reliable: false, contrast: false, phrases: [], passages: [] }
  // Silence is measured pauses plus the gaps between words; fillers stay speech.
  const silence = mergePauses([...pauses, ...ws.slice(1).map((w, i) => ({ start: ws[i].end, end: w.start }))])
  const counts = ws.map(w => pronunciation(w.text))
  const syllableCounts = counts.map(p => p.syllables), phoneCounts = counts.map(p => p.phones)
  // Each word owns the speaking time from its start to the next word's start.
  const speech = ws.map((w, i) => {
    const end = ws[i + 1]?.start ?? w.end
    return Math.min(syllableCounts[i] * c.maxSyllableSeconds, Math.max(0, end - w.start - silenceBetween(w.start, end, silence)))
  })
  const sum = (xs: number[], from: number, to: number) => xs.slice(from, to + 1).reduce((a, b) => a + b, 0)
  const rate = (from: number, to: number) => sum(syllableCounts, from, to) / Math.max(0.01, sum(speech, from, to))
  const span = (a: number, b: number): Span => ({ first: ws[a].index, last: ws[b].index, start: ws[a].start, end: ws[b].end, text: ws.slice(a, b + 1).map(w => w.text).join(" ") })
  const totalSpeech = sum(speech, 0, ws.length - 1), articulationRate = rate(0, ws.length - 1)
  const known = counts.filter(p => p.known).length / counts.length
  // Below 70% dictionary words or above 12 syllables/s, the transcript or timing is wrong.
  const reliable = totalSpeech >= c.minSpeechSeconds && known >= 0.7 && articulationRate <= 12
  const base = { pace: measurePace(words, silence), speakingRate: sum(syllableCounts, 0, ws.length - 1) / (ws.at(-1)!.end - ws[0].start), articulationRate, reliable, contrast: false, phrases: [], passages: [] }
  if (!reliable) return { ...base, marks: [] }

  // Sustained speed: slide a window of speaking time across the words;
  // overlapping windows that cross the same threshold form one passage.
  const need = Math.min(c.sustainedSeconds, totalSpeech) - 1e-9
  const flagged: Record<SpeedRule, [number, number][]> = { RATE_IMPORTANCE_FAST: [], RATE_IMPORTANCE_SLOW: [] }
  for (let i = 0, j = 0, have = 0; i < ws.length; have -= speech[i], i++) {
    while (j < ws.length && have < need) have += speech[j++]
    if (have < need) break
    const r = rate(i, j - 1)
    const rule: SpeedRule | undefined = r >= c.fastRate ? "RATE_IMPORTANCE_FAST" : r <= c.slowRate ? "RATE_IMPORTANCE_SLOW" : undefined
    if (!rule) continue
    const runs = flagged[rule], last = runs.at(-1)
    if (last && i <= last[1]) last[1] = Math.max(last[1], j - 1)
    else runs.push([i, j - 1])
  }
  const marks: RateMark[] = (Object.entries(flagged) as [SpeedRule, [number, number][]][]).flatMap(([rule, runs]) =>
    runs.map(([a, b]): RateMark => ({ ...span(a, b), rule, articulationRate: rate(a, b) })))

  // Contrast: phrase pace in phones per second of speaking, relative to the speaker's own median phrase.
  const position = new Map(ws.map((w, i) => [w.index, i]))
  const phrases: Phrase[] = (pacing?.phrases ?? []).flatMap(([first, last], k) => {
    const from = position.get(first), to = position.get(last)
    if (from === undefined || to === undefined || sum(syllableCounts, from, to) < 3) return []
    const seconds = sum(speech, from, to)
    return seconds > 0.15 ? [{ ...span(from, to), from, to, score: pacing!.scores[k], pace: sum(phoneCounts, from, to) / seconds }] : []
  })
  const normal = [...phrases.map(p => p.pace)].sort((a, b) => a - b)[Math.floor(phrases.length / 2)]
  phrases.forEach(p => { p.pace = Math.log2(p.pace / normal) })
  const passages: Phrase[][] = []
  for (let i = 0; i < phrases.length; i += c.passagePhrases) passages.push(phrases.slice(i, i + c.passagePhrases))
  // A short tail joins the passage before it rather than being judged alone.
  if (passages.length > 1 && passages.at(-1)!.length < c.passagePhrases / 2) passages.at(-2)!.push(...passages.pop()!)
  const speedRuns = marks.slice()
  const judged: RateAnalysis["passages"] = []
  for (const passage of passages) {
    const key = passage.filter(p => p.score < 0), setup = passage.filter(p => p.score > 0)
    if (key.length < 2 || setup.length < 2) continue
    const keyPace = mean(key.map(p => p.pace)), setupPace = mean(setup.map(p => p.pace))
    const first = passage[0], last = passage.at(-1)!
    // Flag only when the key points were not slower than the setup at all.
    const flagged = keyPace >= setupPace - 1e-9 && !speedRuns.some(m => m.first <= last.last && first.first <= m.last)
    judged.push({ ...span(first.from, last.to), keyPace, setupPace, flagged })
    if (!flagged) continue
    const rushed = key.filter(p => p.pace >= setupPace).sort((a, b) => a.score - b.score || b.pace - a.pace)[0]
    const dragged = setup.filter(p => p.pace <= keyPace).sort((a, b) => b.score - a.score || a.pace - b.pace)[0]
    const suggestions: Suggestion[] = [
      ...(rushed ? [{ ...span(rushed.from, rushed.to), direction: "slow_down" as const }] : []),
      ...(dragged ? [{ ...span(dragged.from, dragged.to), direction: "speed_up" as const }] : []),
    ]
    marks.push({ ...span(first.from, last.to), rule: "RATE_CONTRAST", articulationRate: rate(first.from, last.to), suggestions })
  }
  return { ...base, contrast: judged.length > 0, marks: marks.sort((a, b) => a.start - b.start), passages: judged,
    phrases: phrases.map(({ first, last, start, end, text, score, pace }) => ({ first, last, start, end, text, score, pace })) }
}
