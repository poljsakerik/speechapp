/**
 * Rate of speech: how fast the words themselves are spoken.
 *
 * Rate is articulation rate, syllables per second of actual speaking with
 * pauses left out. Listeners judge speed mostly from articulation, and pausing
 * is a separate fundamental, so no pause decides a rate finding.
 *
 * A finding needs a sustained stretch: 15 s of speaking, or the whole clip
 * when it is shorter. Short bursts are ordinary, even for professional
 * speakers. The thresholds are round numbers outside everyday speech: over
 * about three hours of held-out recordings from four speakers, sustained
 * articulation stayed between 3.3 and 7.0 syllables/s; the published mean
 * for spontaneous American English is about 5.1.
 */
import { measurePace, mergePauses, silenceBetween, type PaceProfile } from "./pace.ts"
import { pronunciation } from "./syllables.ts"
import type { Word } from "./types.ts"
import type { Pause } from "./pauses.ts"
export { syllables } from "./syllables.ts"

// Keep the existing speed-action IDs so saved highlights remain readable.
export type RateRule = "RATE_IMPORTANCE_FAST" | "RATE_IMPORTANCE_SLOW"
export type RateMark = { first: number; last: number; start: number; end: number; text: string; rule: RateRule; articulationRate: number }
export type RateAnalysis = {
  pace?: PaceProfile; marks: RateMark[]
  speakingRate?: number; articulationRate?: number
  /** False when there is too little usable speech to judge. */
  reliable: boolean
}
export const RATE_VERSION = 19
/** Rates are syllables/second of speaking; durations are seconds of speaking. */
export const DEFAULT_RATE_CONFIG = {
  sustainedSeconds: 15, // Or the whole clip, if it has less speech than this.
  minSpeechSeconds: 5, // Less speech than this cannot be judged.
  fastRate: 8,
  slowRate: 3,
  maxSyllableSeconds: 1, // Longer than this is not speech: music or noise the word timing absorbed.
}
export type RateConfig = typeof DEFAULT_RATE_CONFIG

type Timed = Word & { index: number; start: number; end: number }

export function detectRate(words: Word[], config: Partial<RateConfig> = {}, pauses: Pause[] = []): RateAnalysis {
  const c = { ...DEFAULT_RATE_CONFIG, ...config }
  const ws = words.map((w, index) => ({ ...w, index })).filter((w): w is Timed =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start! >= 0 && w.end! > w.start!)
  if (ws.length < 2 || ws.length !== words.length || ws.some((w, i) => i && w.start < ws[i - 1].start)) return { marks: [], reliable: false }
  // Silence is measured pauses plus the gaps between words; fillers stay speech.
  const silence = mergePauses([...pauses, ...ws.slice(1).map((w, i) => ({ start: ws[i].end, end: w.start }))])
  const counts = ws.map(w => pronunciation(w.text))
  const syllableCounts = counts.map(p => p.syllables)
  // Each word owns the speaking time from its start to the next word's start.
  const speech = ws.map((w, i) => {
    const end = ws[i + 1]?.start ?? w.end
    return Math.min(syllableCounts[i] * c.maxSyllableSeconds, Math.max(0, end - w.start - silenceBetween(w.start, end, silence)))
  })
  const sum = (xs: number[], from: number, to: number) => xs.slice(from, to + 1).reduce((a, b) => a + b, 0)
  const rate = (from: number, to: number) => sum(syllableCounts, from, to) / Math.max(0.01, sum(speech, from, to))
  const totalSpeech = sum(speech, 0, ws.length - 1), articulationRate = rate(0, ws.length - 1)
  const known = counts.filter(p => p.known).length / counts.length
  // Below 70% dictionary words or above 12 syllables/s, the transcript or timing is wrong.
  const reliable = totalSpeech >= c.minSpeechSeconds && known >= 0.7 && articulationRate <= 12
  const base = { pace: measurePace(words, silence), speakingRate: sum(syllableCounts, 0, ws.length - 1) / (ws.at(-1)!.end - ws[0].start), articulationRate, reliable }
  if (!reliable) return { ...base, marks: [] }

  // Slide a window of sustained speaking time across the words; overlapping
  // windows that cross the same threshold form one passage.
  const need = Math.min(c.sustainedSeconds, totalSpeech) - 1e-9
  const flagged: Record<RateRule, [number, number][]> = { RATE_IMPORTANCE_FAST: [], RATE_IMPORTANCE_SLOW: [] }
  for (let i = 0, j = 0, have = 0; i < ws.length; have -= speech[i], i++) {
    while (j < ws.length && have < need) have += speech[j++]
    if (have < need) break
    const r = rate(i, j - 1)
    const rule: RateRule | undefined = r >= c.fastRate ? "RATE_IMPORTANCE_FAST" : r <= c.slowRate ? "RATE_IMPORTANCE_SLOW" : undefined
    if (!rule) continue
    const runs = flagged[rule], last = runs.at(-1)
    if (last && i <= last[1]) last[1] = Math.max(last[1], j - 1)
    else runs.push([i, j - 1])
  }
  const marks = (Object.entries(flagged) as [RateRule, [number, number][]][]).flatMap(([rule, runs]) => runs.map(([a, b]): RateMark => ({
    first: ws[a].index, last: ws[b].index, start: ws[a].start, end: ws[b].end,
    text: ws.slice(a, b + 1).map(w => w.text).join(" "), rule, articulationRate: rate(a, b),
  })))
  return { ...base, marks: marks.sort((a, b) => a.start - b.start) }
}
