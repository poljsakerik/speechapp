/**
 * Rate of speech: is the pace varied, and where does it get in the way?
 *
 * Varied pace keeps speech interesting, and slowing down is one way to land a
 * point, but a good speaker doesn't slow down for every important word. So this
 * stage looks for the few things worth fixing rather than grading every phrase:
 *
 * - RATE_IMPORTANCE_FAST: slow down on the identified message phrase.
 * - RATE_IMPORTANCE_SLOW: speed up through the identified supporting phrase.
 *
 * Low delivery variation is an internal cue for selecting specific phrases,
 * never a separate whole-passage finding.
 *
 * With message-first labels, only "message" phrases can be rushed and only
 * "unimportant" ones dragged; "important" ones (punchlines, key facts) are
 * free to go either way. Labels from plain importance marking have no
 * "message", so "important" stands in for it.
 *
 * Outliers are ranked by impact, the seconds that fixing them would add or
 * save, and only the top few per minute are kept.
 *
 * Pace is seconds per syllable over the words actually spoken; filler words and
 * the time they take are left out. Every threshold lives in RateConfig so it
 * can be retuned without touching the logic.
 */
import type { Importance, MarkedWord } from "./importance.ts"

export type RateRule = "RATE_IMPORTANCE_FAST" | "RATE_IMPORTANCE_SLOW"

export type RateConfig = {
  // Reference
  /** Seconds per syllable at a comfortable presentation pace. */
  referencePace: number

  // Phrasing
  /** A silence at least this long (seconds) ends a phrase. */
  pauseSplit: number
  /** Gaps between words shorter than this count as speaking time. */
  pauseGap: number
  /** Phrases with fewer syllables are too short to judge. */
  minSyllables: number

  // Variance
  /** Seconds of speech over which pace variation is measured. */
  varianceWindow: number
  /** Seconds between the starts of consecutive variance windows. */
  varianceStep: number
  /** Below this standard deviation of log2 pace, a window has little pace contrast (0.1 is about ±7%). */
  monotoneBelow: number
  /** Windows with fewer phrases are too sparse to judge. */
  minWindowPhrases: number
  /** Low-variation stretches shorter than this (seconds) do not generate contrast suggestions. */
  minMonotoneSeconds: number

  // Outliers
  /** Labels whose phrases can be rushed; the first present in the transcript is used. */
  rushLabels: Importance[]
  /** Labels whose phrases can be dragging. */
  dragLabels: Importance[]
  /** An unimportant phrase slower than referencePace × dragAbove is dragging. */
  dragAbove: number
  /** A message phrase faster than referencePace × rushBelow may be rushed... */
  rushBelow: number
  /** ...unless it is at least this many times slower than the phrases around it... */
  rushContrast: number
  /** ...(seconds either side that count as around it)... */
  contrastWindow: number
  /** ...or a pause at least this long (seconds) sits right before or after it. */
  emphasisPause: number
  /** Neighbouring outlier phrases of one rule this close together (seconds) count as one issue. */
  mergeGap: number
  /** The pace, as a multiple of referencePace, a rushed message phrase should reach. */
  messagePace: number
  /** Dragging that would save less than this many seconds is dropped. */
  minDragImpact: number
  /** A rushed point that slowing down would lengthen by less than this many seconds is dropped. Message phrases are short, so this is lower. */
  minRushImpact: number
  /** Coaching opportunities per minute. A contrast opportunity can emit a pair of phrase marks. */
  marksPerMinute: number
}

/**
 * Calibrated on the one good delivery we have, the recording-03 re-record,
 * not on the practice takes: its median pace is 0.253 s per syllable (136 wpm
 * with pauses), its slowest 3% of phrases run 1.4x that, and its pace
 * variation over 30 s windows never drops below 0.15, and none of its
 * dragging would save a full second (the most is 0.8 s); it rushes no message
 * phrase. So dragAbove, monotoneBelow, minDragImpact and minRushImpact sit just outside what the good delivery does; monotoneBelow
 * 0.1 (about ±7%) is also close to the ~6% change listeners can notice.
 */
export const DEFAULT_RATE_CONFIG: RateConfig = {
  referencePace: 0.25,
  pauseSplit: 0.3,
  pauseGap: 0.25,
  minSyllables: 3,
  varianceWindow: 30,
  varianceStep: 5,
  monotoneBelow: 0.1,
  minWindowPhrases: 6,
  minMonotoneSeconds: 20,
  rushLabels: ["message", "important"],
  dragLabels: ["unimportant"],
  dragAbove: 1.5,
  rushBelow: 1,
  rushContrast: 1.1,
  contrastWindow: 10,
  emphasisPause: 0.6,
  mergeGap: 1,
  messagePace: 1.2,
  minDragImpact: 1,
  minRushImpact: 0.5,
  marksPerMinute: 1,
}

type Timed = MarkedWord & { start: number; end: number }

export type RatePhrase = {
  importance: Exclude<Importance, "filler">
  words: Timed[]
  syllables: number
  seconds: number
  /** Silence before and after the phrase, in seconds. */
  pauseBefore: number
  pauseAfter: number
}

/** A phrase in the transcript: inclusive word indexes, times, and pace over referencePace (above 1 is slower). */
export type PhraseRef = { first: number; last: number; start: number; end: number; ratio: number; text: string }

export type RateMark = PhraseRef & {
  rule: RateRule
  /** Estimated seconds the phrase adjustment would add (slow down) or save (speed up). */
  impact: number

}

export type VarianceWindow = { start: number; end: number; sd: number }

export type RateResult = {
  /** The speaker's median seconds per syllable. */
  speakerPace: number | undefined
  /** Median pace variation over the windows (SD of log2 pace). */
  variation: number | undefined
  windows: VarianceWindow[]
  marks: RateMark[]
}

export function detectRate(words: MarkedWord[], config: Partial<RateConfig> = {}): RateResult {
  const c = { ...DEFAULT_RATE_CONFIG, ...config }
  // Variation belongs to the delivery, so it is measured over phrases split at
  // pauses only; outliers are judged per importance run.
  const breaths = ratePhrases(words, c, false).filter((p) => p.syllables >= c.minSyllables)
  const phrases = ratePhrases(words, c, true).filter((p) => p.syllables >= c.minSyllables)
  const windows = varianceWindows(breaths, c)
  const rushLabel = c.rushLabels.find((label) => words.some((w) => w.importance === label))
  const canRush = (p: RatePhrase) => p.importance === rushLabel
  const canDrag = (p: RatePhrase) => c.dragLabels.includes(p.importance)
  const contrastGroups = monotoneStretches(windows, breaths, c)
    .map(stretch => suggestAdjustments(stretch, phrases, canRush, canDrag, c))
    .filter(group => group.length)

  // Outlier phrases, with directly neighbouring ones of the same rule merged into one issue.
  const groups: { rule: RateRule; phrases: RatePhrase[]; next: number }[] = []
  for (const [i, p] of phrases.entries()) {
    const ratio = paceRatio(p, c)
    const rule: RateRule | undefined =
      canDrag(p) && ratio > c.dragAbove ? "RATE_IMPORTANCE_SLOW"
      : canRush(p) && ratio < c.rushBelow && !emphasized(p, phrases, c) ? "RATE_IMPORTANCE_FAST"
      : undefined
    if (!rule) continue
    const last = groups[groups.length - 1]
    const adjacent = last?.rule === rule && last.next === i && start(p) - end(last.phrases[last.phrases.length - 1]) <= c.mergeGap
    if (adjacent) last.phrases.push(p)
    else groups.push({ rule, phrases: [p], next: 0 })
    groups[groups.length - 1].next = i + 1
  }
  const outliers = groups.map(({ rule, phrases: run }): RateMark => {
    const seconds = run.reduce((sum, p) => sum + p.seconds, 0)
    const syllableCount = run.reduce((sum, p) => sum + p.syllables, 0)
    const expected = syllableCount * c.referencePace
    return {
      ...span(run, c),
      rule,
      impact: rule === "RATE_IMPORTANCE_SLOW" ? seconds - expected : expected * c.messagePace - seconds,
    }
  })

  const timed = words.filter((w) => w.start !== undefined && w.end !== undefined)
  const minutes = timed.length ? (timed[timed.length - 1].end! - timed[0].start!) / 60 : 0
  const budget = Math.max(1, Math.round(minutes * c.marksPerMinute))
  const contrast = contrastGroups.slice(0, budget).flat()
  const overlapsContrast = (m: RateMark) => contrast.some(p => p.rule === m.rule && p.first <= m.last && m.first <= p.last)
  const kept = outliers
    .filter(m => !overlapsContrast(m))
    .filter((m) => m.impact >= (m.rule === "RATE_IMPORTANCE_SLOW" ? c.minDragImpact : c.minRushImpact))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, Math.max(0, budget - Math.min(contrastGroups.length, budget)))

  return {
    speakerPace: medianPace(breaths, c.minSyllables * 3),
    variation: median(windows.map((w) => w.sd)),
    windows,
    marks: [...contrast, ...kept].sort((a, b) => a.start - b.start),
  }
}

/**
 * Split non-filler words into phrases at sentence ends and pauses of at least
 * `pauseSplit`, and, with `byImportance`, wherever the importance label
 * changes. A filler between two words counts as a pause. Without importance
 * splits, a phrase takes the highest label among its words.
 */
export function ratePhrases(
  words: MarkedWord[],
  config: Pick<RateConfig, "pauseSplit" | "pauseGap">,
  byImportance = true,
): RatePhrase[] {
  const phrases: RatePhrase[] = []
  let current: RatePhrase | undefined
  let previous: Timed | undefined
  for (const w of words) {
    const { importance } = w
    if (importance === "filler" || w.start === undefined || w.end === undefined) continue
    const word = w as Timed
    const gap = previous ? Math.max(0, word.start - previous.end) : 0
    const sentenceEnded = previous !== undefined && /[.!?]["”’)]*$/.test(previous.text)
    const labelChanged = byImportance && current?.importance !== importance
    if (!current || labelChanged || gap >= config.pauseSplit || sentenceEnded) {
      if (current) current.pauseAfter = gap
      current = { importance, words: [], syllables: 0, seconds: 0, pauseBefore: gap, pauseAfter: 0 }
      phrases.push(current)
    } else {
      if (gap < config.pauseGap) current.seconds += gap
      if (RANK[importance] > RANK[current.importance]) current.importance = importance
    }
    current.words.push(word)
    current.syllables += syllables(word.text)
    current.seconds += word.end - word.start
    previous = word
  }
  return phrases
}

const RANK: Record<RatePhrase["importance"], number> = { unimportant: 0, important: 1, message: 2 }

const start = (p: RatePhrase) => p.words[0].start
const end = (p: RatePhrase) => p.words[p.words.length - 1].end
const middle = (p: RatePhrase) => (start(p) + end(p)) / 2
const paceRatio = (p: RatePhrase, c: RateConfig) => p.seconds / p.syllables / c.referencePace

function ref(p: RatePhrase, c: RateConfig): PhraseRef {
  return span([p], c)
}

/** One reference covering consecutive phrases, with their combined pace. */
function span(run: RatePhrase[], c: RateConfig): PhraseRef {
  const first = run[0]
  const last = run[run.length - 1]
  const seconds = run.reduce((sum, p) => sum + p.seconds, 0)
  const syllableCount = run.reduce((sum, p) => sum + p.syllables, 0)
  return {
    first: first.words[0].index,
    last: last.words[last.words.length - 1].index,
    start: start(first),
    end: end(last),
    ratio: syllableCount ? seconds / syllableCount / c.referencePace : 1,
    text: run.map((p) => p.words.map((w) => w.text).join(" ")).join(" "),
  }
}

/** A message phrase is emphasized if a pause frames it or it is clearly slower than the phrases around it. */
function emphasized(p: RatePhrase, phrases: RatePhrase[], c: RateConfig): boolean {
  if (p.pauseBefore >= c.emphasisPause || p.pauseAfter >= c.emphasisPause) return true
  const around = phrases.filter((q) => q !== p && Math.abs(middle(q) - middle(p)) <= c.contrastWindow)
  const local = medianPace(around, c.minSyllables)
  return local !== undefined && p.seconds / p.syllables >= local * c.rushContrast
}

/** Syllable-weighted standard deviation of log2 pace in windows sliding over the recording. */
export function varianceWindows(phrases: RatePhrase[], c: RateConfig): VarianceWindow[] {
  if (!phrases.length) return []
  const points = phrases.map((p) => ({ t: middle(p), x: Math.log2(paceRatio(p, c)), w: p.syllables }))
  const first = points[0].t
  const last = points[points.length - 1].t
  const windows: VarianceWindow[] = []
  for (let from = first; from === first || from + c.varianceWindow <= last; from += c.varianceStep) {
    const inside = points.filter((q) => q.t >= from && q.t <= from + c.varianceWindow)
    if (inside.length < c.minWindowPhrases) continue
    const weight = inside.reduce((sum, q) => sum + q.w, 0)
    const mean = inside.reduce((sum, q) => sum + q.w * q.x, 0) / weight
    const sd = Math.sqrt(inside.reduce((sum, q) => sum + q.w * (q.x - mean) ** 2, 0) / weight)
    windows.push({ start: from, end: from + c.varianceWindow, sd })
  }
  return windows
}

/** Merge overlapping low-variation windows into stretches, snapped to the phrases inside them. */
function monotoneStretches(windows: VarianceWindow[], phrases: RatePhrase[], c: RateConfig) {
  const merged: { start: number; end: number }[] = []
  for (const w of windows) {
    if (w.sd >= c.monotoneBelow) continue
    const last = merged[merged.length - 1]
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end)
    else merged.push({ start: w.start, end: w.end })
  }
  return merged.flatMap((s) => {
    const inside = phrases.filter((p) => middle(p) >= s.start && middle(p) <= s.end)
    if (!inside.length) return []
    const snapped = { start: start(inside[0]), end: end(inside[inside.length - 1]) }
    return snapped.end - snapped.start >= c.minMonotoneSeconds ? [snapped] : []
  })
}

/** Select concrete adjustments from a low-variation passage, without a passage-level mark. */
function suggestAdjustments(
  stretch: { start: number; end: number },
  phrases: RatePhrase[],
  canRush: (p: RatePhrase) => boolean,
  canDrag: (p: RatePhrase) => boolean,
  c: RateConfig,
): RateMark[] {
  const inside = phrases.filter(p => middle(p) >= stretch.start && middle(p) <= stretch.end)
  const byPace = (a: RatePhrase, b: RatePhrase) => paceRatio(a, c) - paceRatio(b, c)
  const slowDown = inside.filter(p => canRush(p) && !emphasized(p, phrases, c)).sort(byPace)[0]
  // Speeding up the setup serves a contrasting message phrase, not speed for its own sake.
  if (!slowDown) return []
  const speedUp = inside.filter(canDrag).sort(byPace).at(-1)
  const marks: RateMark[] = [{
    ...ref(slowDown, c), rule: "RATE_IMPORTANCE_FAST",
    impact: Math.max(0, slowDown.syllables * c.referencePace * c.messagePace - slowDown.seconds),
  }]
  if (speedUp) marks.push({
    ...ref(speedUp, c), rule: "RATE_IMPORTANCE_SLOW",
    impact: Math.max(0, speedUp.seconds - speedUp.syllables * c.referencePace / c.messagePace),
  })
  return marks
}

/** Syllable-weighted median seconds per syllable; undefined with fewer than `minTotal` syllables. */
function medianPace(phrases: RatePhrase[], minTotal: number): number | undefined {
  const paces = phrases
    .filter((p) => p.syllables > 0)
    .map((p) => ({ pace: p.seconds / p.syllables, weight: p.syllables }))
    .sort((a, b) => a.pace - b.pace)
  const total = paces.reduce((sum, p) => sum + p.weight, 0)
  if (!total || total < minTotal) return undefined
  let seen = 0
  for (const p of paces) {
    seen += p.weight
    if (seen >= total / 2) return p.pace
  }
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Approximate syllable count of a transcript word. Numbers get one syllable per digit plus one. */
export function syllables(text: string): number {
  const digits = text.replace(/\D/g, "").length
  if (digits) return digits + 1
  const word = text.toLowerCase().replace(/[^a-z]/g, "")
  if (!word) return 0
  let count = word.match(/[aeiouy]+/g)?.length ?? 0
  if (count > 1 && /[^aeiouyl]e$/.test(word)) count--
  return Math.max(1, count)
}
