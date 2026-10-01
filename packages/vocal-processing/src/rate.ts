/** Rate coaching: measure pacing first, then check interrupted thoughts in full context. */
import { measurePace, mergePauses, silenceBetween, type PaceProfile } from "./pace.ts"
import { pronunciation, syllables } from "./syllables.ts"
import type { Word } from "./types.ts"
import type { Pause } from "./pauses.ts"
export { syllables } from "./syllables.ts"

// Keep the existing speed-action IDs so saved highlights remain readable.
export type RateRule = "RATE_IMPORTANCE_FAST" | "RATE_IMPORTANCE_SLOW" | "RATE_VARIATION" | "RATE_FLOW"
export type PhraseRef = { first: number; last: number; start: number; end: number; text: string }
export type RateMark = PhraseRef & { rule: RateRule; impact: number }
export type RateCandidate = RateMark & {
  id: string; articulationRate: number; speakingRate: number
  /** Fragmented clauses go to contextual review; other patterns are reported as measured. */
  pattern?: "fragmented"
  cadenceRates?: number[]
}
export type RateAnalysis = {
  pace?: PaceProfile; candidates: RateCandidate[]
  speakingRate?: number; articulationRate?: number; duration: number; reliable: boolean
}
export const RATE_VERSION = 18
/**
 * Detector tuning. Rates are syllables/second; durations are seconds.
 * Margins on the development benchmark are noted where a value separates
 * flagged and clean takes.
 */
export const DEFAULT_RATE_CONFIG = {
  // Reliability.
  minSeconds: 5,
  minSpeechSeconds: 2, // Active speech, excluding silence.
  minDictionaryCoverage: 0.7, // Fraction of words with known pronunciations.
  maxPlausibleRate: 12, // Faster articulation means the timing is wrong.
  pauseSeconds: 0.3, // A word gap this long is a pause, as are measured silences.

  // Sustained pace over sliding windows. Fast counts silence, because pausing
  // relieves fast speech; slow excludes it, because a pause is not dragging.
  windowSeconds: 8,
  fastRate: 8, // Speaking rate. Flagged 8.9; others at most 7.5.
  slowRate: 3, // Articulation rate. Flagged 2.8; clean at least 3.3.

  // Even cadence: a run of words with no pause at a near-constant rate.
  evenWords: 30,
  cadenceBlockWords: 5,
  flatVariation: 0.3, // SD of log2 block rates. Flagged 0.15-0.18; clean at least 0.44.

  // Interrupted flow inside one clause.
  minFlowSeconds: 4,
  minFlowPauses: 2,
  flowSilenceFraction: 0.35, // Flagged 40-48%; clean at most 26%.

  // Final feedback selection (used by rate-review.ts).
  maxMarksPerMinute: 3,
}
export type RateConfig = typeof DEFAULT_RATE_CONFIG

type Timed = Word & { index: number; start: number; end: number }
const sd = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}

/** No text-importance labels or reference-speaker identity enter candidate generation. */
export function detectRate(words: Word[], config: Partial<RateConfig> = {}, pauses: Pause[] = []): RateAnalysis {
  const c = { ...DEFAULT_RATE_CONFIG, ...config }
  const ws = words.map((w, index) => ({ ...w, index })).filter((w): w is Timed =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start! >= 0 && w.end! > w.start!)
  if (ws.length < 2 || ws.length !== words.length || ws.some((w, i) => i && w.start < ws[i - 1].start)) return { candidates: [], duration: 0, reliable: false }
  // Word gaps count where the audio has no measured silence. Fillers remain
  // speech: deleting them used to manufacture silent pauses.
  const silence = mergePauses([...pauses, ...ws.slice(1).flatMap((w, i) => w.start - ws[i].end >= c.pauseSeconds ? [{ start: ws[i].end, end: w.start }] : [])])
  const measure = (from: number, to: number) => {
    const start = ws[from].start, end = ws[to].end, counts = ws.slice(from, to + 1).map(w => pronunciation(w.text))
    const count = counts.reduce((s, p) => s + p.syllables, 0), speech = Math.max(0.01, end - start - silenceBetween(start, end, silence))
    return { first: ws[from].index, last: ws[to].index, start, end, text: ws.slice(from, to + 1).map(w => w.text).join(" "),
      speech, speakingRate: count / (end - start), articulationRate: count / speech, coverage: counts.filter(p => p.known).length / counts.length }
  }
  const candidates: RateCandidate[] = []
  const add = (from: number, to: number, rule: RateRule, strength: number, extra: Partial<RateCandidate> = {}) => {
    const { first, last, start, end, text, speakingRate, articulationRate } = measure(from, to)
    candidates.push({ id: "", first, last, start, end, text, rule, impact: strength * (end - start), speakingRate, articulationRate, ...extra })
  }
  // Consecutive flagged windows form one passage, measured as a whole.
  const runs = (flagged: [number, number][]) => flagged.reduce<[number, number][]>((out, [a, b]) => {
    const last = out.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
    return out
  }, [])

  // Sustained fast or slow delivery.
  const fast: [number, number][] = [], slow: [number, number][] = []
  for (let i = 0, j = 0; i < ws.length; i++) {
    while (j < ws.length && ws[j].end - ws[i].start < c.windowSeconds) j++
    if (j === ws.length) break
    const m = measure(i, j)
    if (m.speakingRate >= c.fastRate) fast.push([i, j])
    if (m.articulationRate <= c.slowRate) slow.push([i, j])
  }
  for (const [a, b] of runs(fast)) add(a, b, "RATE_IMPORTANCE_FAST", measure(a, b).speakingRate / c.fastRate)
  for (const [a, b] of runs(slow)) add(a, b, "RATE_IMPORTANCE_SLOW", c.slowRate / measure(a, b).articulationRate)

  // Even cadence: no pause at all, and every block of words at nearly the same rate.
  const blockRate = (i: number) => {
    const end = ws[i + c.cadenceBlockWords]?.start ?? ws[i + c.cadenceBlockWords - 1].end // Includes the gap before the next word.
    return ws.slice(i, i + c.cadenceBlockWords).reduce((s, w) => s + syllables(w.text), 0) / (end - ws[i].start)
  }
  const even: [number, number][] = []
  for (let from = 0; from + c.evenWords <= ws.length; from += c.cadenceBlockWords) {
    const to = from + c.evenWords - 1
    if (silence.some(p => p.end > ws[from].start && p.start < ws[to].end && p.end - p.start >= c.pauseSeconds)) continue
    const blocks: number[] = []
    for (let i = from; i + c.cadenceBlockWords - 1 <= to; i += c.cadenceBlockWords) blocks.push(blockRate(i))
    if (sd(blocks.map(Math.log2)) <= c.flatVariation) even.push([from, to])
  }
  // A sustained speed problem already explains a flat stretch.
  const speed = candidates.slice()
  for (const [a, b] of runs(even)) {
    if (speed.some(s => s.first <= ws[b].index && ws[a].index <= s.last)) continue
    const blocks: number[] = []
    for (let i = a; i + c.cadenceBlockWords - 1 <= b; i += c.cadenceBlockWords) blocks.push(blockRate(i))
    add(a, b, "RATE_VARIATION", 1 + c.flatVariation - sd(blocks.map(Math.log2)), { cadenceRates: blocks })
  }

  // Repeated interruptions inside a clause nominate the thought for contextual
  // review. Consecutive interrupted clauses are usually one restarted thought.
  const pace = measurePace(words, silence)
  const interrupted = pace.clauses.flatMap(clause => {
    const duration = clause.end - clause.start
    const internal = clause.internalPauses.reduce((s, q) => s + q.end - q.start, 0)
    return duration >= c.minFlowSeconds && clause.internalPauses.length >= c.minFlowPauses && internal / duration >= c.flowSilenceFraction ? [[clause.first, clause.last] as [number, number]] : []
  })
  for (const [a, b] of runs(interrupted.map(([a, b]) => [a, b + 1]))) {
    const m = measure(a, b - 1)
    add(a, b - 1, "RATE_FLOW", 1 + (1 - m.speech / (m.end - m.start)), { pattern: "fragmented" })
  }

  candidates.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule)).forEach((p, i) => { p.id = `pace-${i + 1}` })
  const total = measure(0, ws.length - 1), duration = total.end - total.start
  return { pace, candidates, speakingRate: total.speakingRate, articulationRate: total.articulationRate, duration,
    reliable: duration >= c.minSeconds && total.speech >= c.minSpeechSeconds && total.coverage >= c.minDictionaryCoverage && total.articulationRate <= c.maxPlausibleRate }
}
