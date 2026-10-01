import assert from "node:assert/strict"
import { test } from "node:test"
import { rateReview, segmentWords } from "./review.ts"

test("rate review preserves both phrase actions within one sentence", () => {
  const words = "We need more time now.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
  const segments = segmentWords(words)
  const marks = [
    { first: 0, last: 1, start: 0, end: 1.8, text: "We need", rule: "RATE_IMPORTANCE_SLOW" as const, ratio: 1, impact: .5 },
    { first: 2, last: 3, start: 2, end: 3.8, text: "more time", rule: "RATE_IMPORTANCE_FAST" as const, ratio: 1, impact: .5 },
  ]
  const findings = rateReview(segments, marks, "We need time").assessments[0].findings
  assert.equal(findings.length, 2)
  assert.deepEqual(findings.map(f => [f.rule_id, f.start, f.end]), [["RATE_IMPORTANCE_SLOW", 0, 1.8], ["RATE_IMPORTANCE_FAST", 2, 3.8]])
  assert.equal(findings[0].observation, "This setup took more time than the point needs.")
  assert.equal(findings[1].observation, "This point passed quickly.")
  assert.deepEqual(findings.map(f => f.text), ["We need", "more time"])
})

test("an adjustment crossing segment boundaries retains a precise span in each segment", () => {
  const words = "One. Two three.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
  const marks = [{ first: 0, last: 1, start: 0, end: 1.8, text: "One. Two", rule: "RATE_IMPORTANCE_FAST" as const, ratio: 1, impact: .5 }]
  const findings = rateReview(segmentWords(words), marks, "").assessments[0].findings
  assert.deepEqual(findings.map(f => [f.segment_id, f.start, f.end]), [["segment-1", 0, .8], ["segment-2", 1, 1.8]])
})
