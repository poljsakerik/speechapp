/** Rate coaching: measure pacing first, then check candidate passages in full context. */
import { measurePace, type PaceProfile } from "./pace.ts"
import { pronunciation, syllables } from "./syllables.ts"
import type { Word } from "./types.ts"
import type { Pause } from "./pauses.ts"
export { syllables } from "./syllables.ts"

// Keep the existing speed-action IDs so saved highlights remain readable.
export type RateRule = "RATE_IMPORTANCE_FAST" | "RATE_IMPORTANCE_SLOW" | "RATE_VARIATION" | "RATE_REPETITIVE" | "RATE_FLOW"
export type PhraseRef = { first: number; last: number; start: number; end: number; text: string }
export type RateMark = PhraseRef & { rule: RateRule; impact: number }
export type RatePhrase = PhraseRef & {
  syllables: number; articulationRate: number; speakingRate: number
  speechSeconds: number; pauseSeconds: number; dictionaryCoverage: number
}
export type RateCandidate = RateMark & {
  id: string; articulationRate: number; speakingRate: number; variation: number
  phraseRates: number[]; repetition: number
  cadenceVariation?: number
  cadenceRates?: number[]
  pauseFraction?: number
  pattern?: "fragmented" | "relative-fast" | "relative-slow"
  relativeToBaseline?: number
}
export type RateAnalysis = {
  pace?: PaceProfile
  phrases: RatePhrase[]; candidates: RateCandidate[]; speakingRate?: number
  articulationRate?: number; variation?: number; reliable: boolean
}
export const RATE_VERSION = 17
/** Detector tuning. Rates are syllables/second; durations are seconds unless noted. */
export const DEFAULT_RATE_CONFIG = {
  // Timing and pronunciation reliability.
  minWords: 3,
  minSeconds: 5, // Minimum recording duration and sustained speed-change evidence.
  minSpeechSeconds: 2, // Active speech, excluding silence.
  speechSecondsFloor: 0.01, // Numerical floor for articulation-rate division.
  minDictionaryCoverage: 0.7, // Fraction of words with known pronunciations.
  maxReliableSyllables: 12, // Reject implausibly compressed phrase measurements.
  minVariationPhrases: 3, // Evidence needed to report recording-wide variation.

  // Phrase measurements: punctuation/pause splits, with a syllable cap.
  pauseSplit: 0.3,
  minSyllables: 6, // Minimum before an optional phrase split.
  maxPhraseSyllables: 12, // Split after the word reaching this count.
  minPhraseSyllables: 3, // Shorter phrases cannot provide reliable measurements.

  // Local changes relative to the preceding clauses.
  minClauseWords: 6,
  minClauseSeconds: 2.5,
  baselineLookbackClauses: 3,
  minBaselineClauses: 2,
  baselineMinSyllables: 2,
  baselineMaxSyllables: 10,
  minRelativeSyllables: 8, // Syllable count in the candidate clause.
  relativeChange: 1.4, // Multiplicative change from the local median.
  relativeFastSyllables: 6, // Also require this absolute articulation rate.
  relativeSlowSyllables: 4,

  // Interrupted flow, including merging adjacent interrupted clauses.
  minFlowSeconds: 4,
  minFlowPauses: 2,
  flowSilenceFraction: 0.35, // Internal silence / elapsed clause duration.
  flowMergeGapSeconds: 1.5,
  maxFlowSeconds: 24, // Maximum merged highlight duration.

  // Sustained absolute speed and repetitive phrase-rate patterns.
  minGroupPhrases: 2,
  maxGroupPhrases: 6,
  maxGroupGapSeconds: 2,
  minGroupSyllables: 12,
  fastSyllables: 8,
  fastSpeakingFraction: 0.72, // Speaking rate must also reach this fraction of fastSyllables.
  slowSyllables: 2.8,
  slowSpeakingSyllables: 2, // Silence-inclusive threshold for dragging delivery.
  slowArticulationCeiling: 3.5, // Dragging must also have slow articulation.
  minRepetitionPhrases: 6,
  repetitionLagPhrases: 2, // Compare every other phrase for alternating cadence.
  repetitionTolerance: 0.12, // Maximum RMS difference of lagged log2 phrase rates.
  repetitionContrast: 1.35, // Minimum ratio between each pair of adjacent rates.

  // Sustained even cadence: overlapping word windows and smaller cadence blocks.
  minEvenWords: 30,
  maxEvenWords: 45,
  evenStepWords: 5,
  cadenceBlockWords: 5, // Includes the gap before the following word.
  minEvenSeconds: 7,
  flatVariation: 0.3, // Maximum standard deviation of log2 rates at both scales.
  framingPause: 0.4, // Sentence/clause-boundary pauses exempt the window.

  // Final feedback selection (used by rate-review.ts).
  maxMarksPerMinute: 3,
}
export type RateConfig = typeof DEFAULT_RATE_CONFIG

const sd = (xs: number[]) => {
  if (!xs.length) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}
const sentenceEnd = (text: string) => /[.!?]["”’)]*$/.test(text)
function silentSeconds(start: number, end: number, pauses: Pause[]): number {
  // Union intervals: overlapping detections cannot subtract the same silence twice.
  let total = 0, until = start
  for (const p of pauses.filter(p => p.end > start && p.start < end).sort((a, b) => a.start - b.start)) {
    const from = Math.max(start, until, p.start), to = Math.min(end, p.end)
    if (to > from) total += to - from
    until = Math.max(until, to)
  }
  return total
}

/** No text-importance labels or reference-speaker identity enter candidate generation. */
export function detectRate(words: Word[], config: Partial<RateConfig> = {}, pauses: Pause[] = []): RateAnalysis {
  const c = { ...DEFAULT_RATE_CONFIG, ...config }
  const valid = words.map((w, index) => ({ ...w, index })).filter((w): w is Word & { index: number; start: number; end: number } =>
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start! >= 0 && w.end! > w.start!)
  const ordered = valid.every((w, i) => !i || w.start >= valid[i - 1].start)
  if (!ordered || valid.length < c.minWords) return { phrases: [], candidates: [], reliable: false }
  // Word gaps are used only where the audio has no measured silence. Fillers
  // remain speech: deleting them used to manufacture silent pauses.
  const silence = [...pauses, ...valid.slice(1).flatMap((w, i) => w.start - valid[i].end >= c.pauseSplit ? [{ start: valid[i].end, end: w.start }] : [])]
  const phrases: RatePhrase[] = []
  let first = 0, count = 0
  const phrase = (from: number, to: number): RatePhrase => {
    const selected = valid.slice(from, to + 1), start = selected[0].start, end = selected.at(-1)!.end
    const counts = selected.map(w => pronunciation(w.text))
    const syllables = counts.reduce((s, p) => s + p.syllables, 0), pauseSeconds = silentSeconds(start, end, silence)
    const speechSeconds = Math.max(c.speechSecondsFloor, end - start - pauseSeconds)
    const articulationRate = syllables / speechSeconds
    return { first: selected[0].index, last: selected.at(-1)!.index, start, end, text: selected.map(w => w.text).join(" "), syllables, speechSeconds, pauseSeconds,
      articulationRate, speakingRate: syllables / (end - start),
      dictionaryCoverage: counts.filter(p => p.known).length / counts.length }
  }
  for (let i = 0; i < valid.length; i++) {
    count += syllables(valid[i].text)
    const next = valid[i + 1]
    const gap = next ? silentSeconds(valid[i].start, next.start, silence) : 0
    // Use punctuation and acoustic phrase boundaries. Subdivide long phrases
    // into comparable syllable-sized measurements, never into isolated focal words.
    if (!next || sentenceEnd(valid[i].text) || (count >= c.minSyllables && (gap >= c.pauseSplit || /[,;:]$/.test(valid[i].text) || count >= c.maxPhraseSyllables))) {
      const p = phrase(first, i)
      if (p.syllables >= c.minPhraseSyllables && p.articulationRate <= c.maxReliableSyllables && p.dictionaryCoverage >= c.minDictionaryCoverage) phrases.push(p)
      first = i + 1; count = 0
    }
  }
  const total = phrase(0, valid.length - 1)
  const candidates: RateCandidate[] = []
  const pace = measurePace(words, silence)
  const clauseRates = pace.clauses.map(clause => phrase(clause.first, clause.last).articulationRate)
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const addClauseCandidate = (first: number, last: number, rule: RateRule, pattern: RateCandidate["pattern"], strength: number, baseline?: number) => {
    const p = phrase(first, last)
    candidates.push({ ...p, id: "", rule, pattern, impact: strength * (p.end - p.start),
      variation: 0, phraseRates: [p.articulationRate], repetition: 0,
      relativeToBaseline: baseline ? p.articulationRate / baseline : undefined })
  }
  for (const [index, clause] of pace.clauses.entries()) {
    const p = phrase(clause.first, clause.last), duration = clause.end - clause.start
    if (clause.last - clause.first + 1 < c.minClauseWords || duration < c.minClauseSeconds || p.dictionaryCoverage < c.minDictionaryCoverage || p.articulationRate > c.maxReliableSyllables) continue
    const internal = clause.internalPauses.reduce((s, q) => s + q.end - q.start, 0)
    // Boundary silence alone never triggers fragmented delivery. Repeated interruptions
    // inside an unfinished clause nominate the thought for contextual review.
    if (duration >= c.minFlowSeconds && clause.internalPauses.length >= c.minFlowPauses && internal / duration >= c.flowSilenceFraction) {
      addClauseCandidate(clause.first, clause.last, "RATE_FLOW", "fragmented", 1 + internal / duration)
      continue // Interrupted flow takes precedence over a silence-inflated local speed ratio.
    }
    // Compare with the established pace leading into this clause. Future
    // acceleration must not relabel the preceding steady delivery as slowing.
    const neighbors = clauseRates.slice(Math.max(0, index - c.baselineLookbackClauses), index).filter(r => r >= c.baselineMinSyllables && r <= c.baselineMaxSyllables)
    if (neighbors.length < c.minBaselineClauses || p.syllables < c.minRelativeSyllables) continue
    const baseline = median(neighbors), relative = p.articulationRate / baseline
    const next = pace.clauses[index + 1]
    const nextRate = clauseRates[index + 1]
    const fast = relative >= c.relativeChange && p.articulationRate >= c.relativeFastSyllables
    const slow = relative <= 1 / c.relativeChange && p.articulationRate <= c.relativeSlowSyllables
    // A single short emphasis is an ordinary change, not enough evidence of
    // a pacing problem. Confirm the new pace persists before nominating it.
    const continues = next && (fast ? nextRate >= baseline * c.relativeChange && nextRate >= c.relativeFastSyllables : slow && nextRate <= baseline / c.relativeChange && nextRate <= c.relativeSlowSyllables)
    const last = duration >= c.minSeconds ? clause.last : continues ? next.last : clause.last
    if (valid[last].end - clause.start < c.minSeconds) continue
    if (fast) addClauseCandidate(clause.first, last, "RATE_IMPORTANCE_FAST", "relative-fast", relative, baseline)
    if (slow) addClauseCandidate(clause.first, last, "RATE_IMPORTANCE_SLOW", "relative-slow", 1 / relative, baseline)
  }
  // Adjacent interrupted clauses often belong to one restarted thought. Keep
  // its highlight connected rather than reporting each fragment as a new issue.
  const flows = candidates.filter(c => c.rule === "RATE_FLOW")
  for (let i = 1; i < flows.length; i++) {
    const previous = flows[i - 1], next = flows[i]
    if (next.first === previous.last + 1 && next.start - previous.end <= c.flowMergeGapSeconds && next.end - previous.start <= c.maxFlowSeconds) {
      Object.assign(next, phrase(previous.first, next.last), { impact: previous.impact + next.impact })
      next.phraseRates = [next.articulationRate]
      candidates.splice(candidates.indexOf(previous), 1)
    }
  }
  for (let from = 0; from < phrases.length; from++) {
    const group: RatePhrase[] = []
    for (let j = from; j < phrases.length && group.length < c.maxGroupPhrases; j++) {
      if (j > from && phrases[j].start - phrases[j - 1].end > c.maxGroupGapSeconds) break
      group.push(phrases[j])
      const duration = group.at(-1)!.end - group[0].start
      if (duration < c.minSeconds || group.length < c.minGroupPhrases) continue
      const syllableCount = group.reduce((s, p) => s + p.syllables, 0)
      if (syllableCount < c.minGroupSyllables) continue
      const rate = syllableCount / group.reduce((s, p) => s + p.speechSeconds, 0)
      const rates = group.map(p => p.articulationRate), logs = rates.map(Math.log2), variation = sd(logs)
      const experienced = syllableCount / duration
      const repetition = group.length >= c.minRepetitionPhrases ? Math.sqrt(logs.slice(c.repetitionLagPhrases).reduce((s, x, i) => s + (x - logs[i]) ** 2, 0) / (logs.length - c.repetitionLagPhrases)) : Infinity
      const rules: [RateRule, number][] = []
      let fastStart: number | undefined, longestFast = 0
      for (const p of group) {
        if (p.articulationRate >= c.fastSyllables) {
          fastStart ??= p.start
          longestFast = Math.max(longestFast, p.end - fastStart)
        } else fastStart = undefined
      }
      if (rate >= c.fastSyllables && experienced >= c.fastSyllables * c.fastSpeakingFraction && longestFast >= c.minSeconds) rules.push(["RATE_IMPORTANCE_FAST", rate / c.fastSyllables])
      if (rate <= c.slowSyllables || (experienced < c.slowSpeakingSyllables && rate < c.slowArticulationCeiling)) rules.push(["RATE_IMPORTANCE_SLOW", Math.max(c.slowSyllables / rate, c.slowSpeakingSyllables / experienced)])
      if (group.length >= c.minRepetitionPhrases && repetition <= c.repetitionTolerance && rates.slice(1).every((r, i) => Math.max(r, rates[i]) / Math.min(r, rates[i]) >= c.repetitionContrast)) rules.push(["RATE_REPETITIVE", 1 + c.repetitionTolerance - repetition])
      for (const [rule, strength] of rules) {
        const head = group[0], tail = group.at(-1)!
        candidates.push({ id: "", first: head.first, last: tail.last, start: head.start, end: tail.end,
          text: words.slice(head.first, tail.last + 1).map(w => w.text).join(" "),
          rule, impact: strength * duration, articulationRate: rate, speakingRate: experienced, variation, phraseRates: rates,
          repetition: Number.isFinite(repetition) ? repetition : 0 })
      }
    }
  }
  // Find sustained even runs at a shorter scale so a later acceleration does
  // not erase an earlier flat stretch. The complete clause profile is still
  // available to the reviewer; highlights remain inside the measured run.
  for (let from = 0; from + c.minEvenWords <= valid.length; from += c.evenStepWords) {
    const to = Math.min(from + c.maxEvenWords, valid.length) - 1
    const p = phrase(from, to)
    if (p.end - p.start < c.minEvenSeconds || p.articulationRate >= c.fastSyllables) continue
    if (pace.pauses.some(q => q.boundary !== "within" && q.end - q.start >= c.framingPause && q.start >= p.start && q.end <= p.end)) continue
    if (candidates.some(q => q.rule === "RATE_FLOW" && q.first <= p.last && p.first <= q.last)) continue
    const blocks: number[] = []
    for (let i = from; i + c.cadenceBlockWords - 1 <= to; i += c.cadenceBlockWords) {
      const end = i + c.cadenceBlockWords <= to ? valid[i + c.cadenceBlockWords].start : valid[i + c.cadenceBlockWords - 1].end
      const count = valid.slice(i, i + c.cadenceBlockWords).reduce((sum, word) => sum + syllables(word.text), 0)
      blocks.push(count / (end - valid[i].start))
    }
    const blockVariation = sd(blocks.map(Math.log2))
    const included = phrases.filter(q => q.first >= p.first && q.last <= p.last)
    const rates = included.map(q => q.articulationRate), variation = sd(rates.map(Math.log2))
    if (blockVariation <= c.flatVariation && variation <= c.flatVariation) {
      candidates.push({ ...p, id: "", rule: "RATE_VARIATION",
        impact: (1 + c.flatVariation - blockVariation) * (p.end - p.start),
        variation, phraseRates: rates, cadenceRates: blocks, cadenceVariation: blockVariation,
        pauseFraction: p.pauseSeconds / (p.end - p.start), repetition: 0 })
    }
  }
  // Keep the strongest non-overlapping evidence per rule. Different hypotheses
  // on the same passage are resolved by context, not by hiding them prematurely.
  const kept: RateCandidate[] = []
  for (const candidate of candidates.sort((a, b) => b.impact - a.impact)) {
    if (!kept.some(p => p.rule === candidate.rule && p.first <= candidate.last && candidate.first <= p.last)) kept.push(candidate)
  }
  kept.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule)).forEach((p, i) => { p.id = `pace-${i + 1}` })
  return { pace, phrases, candidates: kept, speakingRate: total.speakingRate, articulationRate: total.articulationRate,
    variation: phrases.length >= c.minVariationPhrases ? sd(phrases.map(p => Math.log2(p.articulationRate))) : undefined,
    reliable: phrases.length > 0 && valid.length === words.length && total.end - total.start >= c.minSeconds && total.speechSeconds >= c.minSpeechSeconds && total.dictionaryCoverage >= c.minDictionaryCoverage }
}
