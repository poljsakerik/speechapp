import assert from "node:assert/strict"
import { test } from "node:test"
import { matchPauseMarks, sourceGroup } from "./pause-evaluation.ts"
import type { PauseMark } from "./pauses.ts"

const mark = (first: number, last: number, rule: PauseMark["rule"] = "PAUSE_NECESSARY"): PauseMark => ({ first, last, rule, start: first, end: last + 1, at: first + 1, text: "", observedSeconds: 0, impact: 1 })

test("all crops stay in their source group", () => {
  assert.deepEqual(["recording-03", "recording-03-pauses", "recording-03-pitch"].map(sourceGroup), Array(3).fill("recording-03"))
  assert.equal(sourceGroup("recording-30"), "recording-30")
})

test("boundary matching needs both sides, not merely one overlapping word", () => {
  const result = matchPauseMarks([mark(0, 1), mark(1, 2), mark(2, 3)], [{ rule: "PAUSE_NECESSARY", words: [1, 2] }])
  assert.deepEqual([...result.matchedPredictions], [1])
})

test("overlapping golden rules survive but repeated predictions cannot inflate precision", () => {
  const golden = [{ rule: "PAUSE_FILLERS", words: [1, 2] }, { rule: "PAUSE_UNNECESSARY", words: [1, 2] }]
  const result = matchPauseMarks([mark(1, 1, "PAUSE_FILLERS"), mark(1, 1, "PAUSE_FILLERS"), mark(1, 2, "PAUSE_UNNECESSARY")], golden)
  assert.equal(result.matchedPredictions.size, 2)
  assert.equal(result.matchedGolden.size, 2)
})
