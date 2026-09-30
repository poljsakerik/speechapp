import type { PauseMark } from "./pauses.ts"

/** Crops such as recording-03-pauses share a source with recording-03. */
export function sourceGroup(id: string): string {
  return id.match(/^(recording-\d+)(?:-|$)/)?.[1] ?? id
}

export type PauseGold = { rule: string; words: number[] }

/** One-to-one matching: a boundary must be bracketed by the golden words;
 * a filler must overlap a golden filler span. A broad annotation cannot count
 * as several true positives. Maximum matching avoids greedy ordering artifacts.
 */
export function matchPauseMarks(marks: PauseMark[], golden: PauseGold[]) {
  const matches = marks.map((mark) => golden.flatMap((gold, i) => {
    const hit = mark.rule === gold.rule && (mark.rule === "PAUSE_FILLERS"
      ? gold.words.some((w) => w >= mark.first && w <= mark.last)
      : gold.words.includes(mark.first) && gold.words.includes(mark.last))
    return hit ? [i] : []
  }))
  const owner = new Map<number, number>()
  const visit = (prediction: number, seen: Set<number>): boolean => {
    for (const gold of matches[prediction]) {
      if (seen.has(gold)) continue
      seen.add(gold)
      const previous = owner.get(gold)
      if (previous === undefined || visit(previous, seen)) {
        owner.set(gold, prediction)
        return true
      }
    }
    return false
  }
  marks.forEach((_, i) => visit(i, new Set()))
  return { matchedPredictions: new Set(owner.values()), matchedGolden: new Set(owner.keys()) }
}
