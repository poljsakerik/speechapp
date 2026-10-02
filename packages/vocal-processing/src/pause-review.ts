/**
 * Pause review: the way a speaking coach marks up a recording. Timing measures
 * every real pause (pause.ts); a model reads the whole transcript with each
 * pause marked in place and judges it from meaning: it fits, breaks the
 * thought, is too short for the moment to land, or too long. For every
 * stretch said without a pause, it decides whether the listener needed one.
 *
 * No fixed syllable counts or durations decide anything: without a model the
 * pause review is not assessed.
 */
import { pauseAfterWords, timed, type PauseMark, type PauseRule } from "./pause.ts"
import type { Pause } from "./pauses.ts"
import { syllables } from "./syllables.ts"
import type { JsonCompletion, Word } from "./types.ts"

export type Verdict = "fits" | "breaks" | "too_short" | "too_long"
export type MarkedPause = { after: number; seconds: number }

export const REVIEW_SYSTEM = `You coach spoken delivery, the way a speaking coach marks up a recording. You get the transcript of a real recording as numbered words. Every pause the speaker made is marked in place, like [P3 0.8s] (pause 3, lasting 0.8 seconds), right after the word it follows. Pauses give the listener time to take in what was said; judge them from the meaning of the whole recording.
1. For every marked pause, give one verdict:
- "fits": a fluent speaker could pause here, for about this long. That includes the end of an idea, after a key point or question, before a reveal or key word for effect, between list items, around an aside, between a long subject and its verb, and before a new clause. Most pauses fit. Very short pauses (under about half a second) are usually breaths or natural phrasing.
- "breaks": a clearly audible stop that interrupts a small unit that belongs together, so it sounds like hesitation or a lost thread: right after an article, preposition, possessive or auxiliary (the, a, of, to, my, is), inside a name, number or fixed phrase, or within a false start, restart or repeated word.
- "too_short": the place is right, but the moment needs time to sink in (a key point, a striking claim or number, a question put to the audience, a reveal) and this pause is too brief to let it land.
- "too_long": for this moment, the silence goes on so long that it stops sounding deliberate and the listener starts to wonder whether the speaker lost their place.
2. Then the stretches the speaker said without any pause are listed with their length. For each, decide whether the listener needed a pause inside it: because ideas blur together, or a key point, claim or question gets no time to land. If so, give the indexes of the words the pause should follow; most stretches need none.
Many deliveries are valid. Only flag what a good speaking coach would clearly correct; when in doubt, leave it. The punctuation comes from speech recognition and can be wrong.`
const schema = {
  type: "object", additionalProperties: false, required: ["pauses", "stretches"],
  properties: {
    pauses: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "verdict"], properties: { id: { type: "integer" }, verdict: { type: "string", enum: ["fits", "breaks", "too_short", "too_long"] } } } },
    stretches: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "pause_after"], properties: { id: { type: "integer" }, pause_after: { type: "array", items: { type: "integer" } } } } },
  },
}

/** Runs of words said without any pause, as [first, last] word indexes. */
export function stretches(words: Word[], marked: MarkedPause[]): [number, number][] {
  const out: [number, number][] = []
  let first = 0
  for (const p of [...marked, { after: words.length - 1 }]) { out.push([first, p.after]); first = p.after + 1 }
  return out
}

/**
 * One request reviews the pauses and stretches in words [from, to]; the whole
 * transcript is always included for context. Long lists made the model's
 * verdicts swing between runs, so takes are reviewed in parts.
 */
export function reviewRequest(words: (Word & { start: number; end: number })[], marked: MarkedPause[], syllables: (text: string) => number, [from, to] = [0, words.length - 1]) {
  const id = new Map(marked.map((p, k) => [p.after, k]))
  const transcript = words.map((w, i) => `${i}:${w.text}${id.has(i) ? ` [P${id.get(i)} ${marked[id.get(i)!].seconds.toFixed(1)}s]` : ""}`).join(" ")
  const runs = stretches(words, marked).flatMap(([a, b], k) => a >= from && b <= to ? [`S${k}: words ${a}-${b}, ${(words[b].end - words[a].start).toFixed(1)}s, ${words.slice(a, b + 1).reduce((n, w) => n + syllables(w.text), 0)} syllables`] : [])
  const ids = marked.flatMap((p, k) => p.after >= from && p.after < to ? [`P${k}`] : [])
  return { system: REVIEW_SYSTEM, user: `Transcript:\n${transcript}\n\nReview only words ${from}-${to}: pauses ${ids.length ? ids.join(", ") : "(none)"} and these stretches without a pause:\n${runs.join("\n")}`, schema, schemaName: "pause_review" }
}

/** Word ranges of about `size` words, cut at pauses so no stretch is split. */
export function reviewParts(words: Word[], marked: MarkedPause[], size = 120): [number, number][] {
  const parts: [number, number][] = []
  let from = 0
  for (const p of marked) if (p.after - from + 1 >= size) { parts.push([from, p.after]); from = p.after + 1 }
  if (from < words.length) parts.push([from, words.length - 1])
  return parts
}

/**
 * Verdicts for the pauses in words [from, to] (undefined outside it) and valid
 * missing positions, or undefined when the reply leaves a pause unjudged.
 */
export function parseReview(words: Word[], marked: MarkedPause[], reply: unknown, [from, to] = [0, words.length - 1]): { verdicts: (Verdict | undefined)[]; missing: number[] } | undefined {
  const data = reply as { pauses?: { id?: unknown; verdict?: unknown }[]; stretches?: { id?: unknown; pause_after?: unknown }[] }
  if (!Array.isArray(data?.pauses) || !Array.isArray(data?.stretches)) return undefined
  const byId = new Map(data.pauses.map(p => [p?.id, p?.verdict]))
  const inside = (p: MarkedPause) => p.after >= from && p.after < to
  const verdicts = marked.map((p, k) => inside(p) ? byId.get(k) : undefined)
  if (marked.some((p, k) => inside(p) && !["fits", "breaks", "too_short", "too_long"].includes(verdicts[k] as string))) return undefined
  const runs = stretches(words, marked)
  const missing = data.stretches.flatMap(s => {
    const run = Number.isInteger(s?.id) ? runs[s.id as number] : undefined
    if (run && (run[0] < from || run[1] > to)) return []
    return run && Array.isArray(s.pause_after) ? s.pause_after.filter((n): n is number => Number.isInteger(n) && n >= run[0] && n < run[1]) : []
  })
  return { verdicts: verdicts as (Verdict | undefined)[], missing: [...new Set(missing)].sort((a, b) => a - b) }
}

/**
 * Pauses whose word boundary the recognizer's own timing confirms. The aligner
 * occasionally moves a short word across a silence ("Here we | go."), which
 * would misplace the pause by a word; findings at such pauses are dropped.
 */
export function confirmedPauses(words: Word[], recognized: Word[], marked: MarkedPause[]) {
  if (recognized.length !== words.length) return marked
  return marked.filter(({ after: i }) => {
    const middle = (words[i].end! + words[i + 1].start!) / 2
    return recognized.findLastIndex(w => w.start! < middle) === i
  })
}

export type PauseReview = { marks: PauseMark[]; reliable: boolean; status: "reviewed" | "no timing" | "no model" | "unusable reply"; marked: MarkedPause[] }

const RULES: Record<Exclude<Verdict, "fits"> | "missing", PauseRule> = { missing: "PAUSE_NECESSARY", too_short: "PAUSE_TOO_SHORT", breaks: "PAUSE_UNNECESSARY", too_long: "PAUSE_TOO_LONG" }

/**
 * Review every pause in a take. `recognized` is the recognizer's timing for the
 * same words when `words` were re-aligned. Findings of one kind close together
 * (within a sentence or so) form one highlight.
 */
export async function reviewPause(words: Word[], pauses: Pause[], complete?: JsonCompletion, recognized?: Word[]): Promise<PauseReview> {
  if (!timed(words)) return { marks: [], reliable: false, status: "no timing", marked: [] }
  const after = pauseAfterWords(words, pauses)
  const marked = after.flatMap((seconds, i) => seconds > 0 ? [{ after: i, seconds }] : [])
  if (!complete) return { marks: [], reliable: false, status: "no model", marked }
  const parts = reviewParts(words, marked)
  const replies = await Promise.all(parts.map(async part => {
    try { return parseReview(words, marked, await complete(reviewRequest(words, marked, syllables, part)), part) } catch { return undefined }
  }))
  if (replies.some(r => !r)) return { marks: [], reliable: false, status: "unusable reply", marked }
  const review = { verdicts: marked.map((_, k) => replies.map(r => r!.verdicts[k]).find(Boolean)), missing: replies.flatMap(r => r!.missing) }
  // Findings next to a pause whose position the two timings disagree on are not reliable.
  const sure = new Set((recognized ? confirmedPauses(words, recognized, marked) : marked).map(p => p.after))
  const unsure = marked.filter(p => !sure.has(p.after)).map(p => p.after)
  const points: { at: number; rule: PauseRule }[] = [
    ...marked.flatMap((p, k) => review.verdicts[k] && review.verdicts[k] !== "fits" && sure.has(p.after) ? [{ at: p.after, rule: RULES[review.verdicts[k] as Exclude<Verdict, "fits">] }] : []),
    ...review.missing.filter(i => !unsure.some(u => Math.abs(u - i) <= 1)).map(at => ({ at, rule: RULES.missing })),
  ].sort((a, b) => a.at - b.at)
  const marks: PauseMark[] = []
  for (const rule of Object.values(RULES)) {
    const groups: number[][] = []
    for (const { at } of points.filter(p => p.rule === rule)) {
      const last = groups.at(-1)
      if (last && at - last.at(-1)! <= 6) last.push(at)
      else groups.push([at])
    }
    for (const at of groups) {
      const first = Math.max(0, at[0] - 2), last = Math.min(words.length - 1, at.at(-1)! + 2)
      marks.push({ first, last, start: words[first].start, end: words[last].end, text: words.slice(first, last + 1).map(w => w.text).join(" "), rule, at })
    }
  }
  return { marks: marks.sort((a, b) => a.start - b.start), reliable: true, status: "reviewed", marked }
}
