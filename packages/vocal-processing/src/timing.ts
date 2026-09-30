import type { Word } from "./importance.ts"

export type TimedWord = Word & { start: number; end: number }
export type WordGap = { after: number; start: number; end: number; seconds: number }

export function isTimed(word: Word): word is TimedWord {
  return typeof word.start === "number" && typeof word.end === "number"
    && Number.isFinite(word.start) && Number.isFinite(word.end)
    && word.start >= 0 && word.end > word.start
}

/** Estimated silence between ORIGINAL adjacent words, including fillers.
 * Never bridge missing/invalid alignment or treat overlapping words as silence.
 */
export function wordGaps(words: Word[]): WordGap[] {
  return words.slice(0, -1).flatMap((left, after) => {
    const right = words[after + 1]
    if (!isTimed(left) || !isTimed(right) || right.start < left.end) return []
    return [{ after, start: left.end, end: right.start, seconds: right.start - left.end }]
  })
}
