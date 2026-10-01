import assert from "node:assert/strict"
import { test } from "node:test"
import { rateReview, segmentWords } from "./review.ts"

test("segments report syllables per second including internal silence", () => {
  const [segment] = segmentWords([
    { text: "people", start: 0, end: .6 },
    { text: "day.", start: .9, end: 1.5 },
  ])
  assert.equal(segment.speakingRate, 2, "three syllables over 1.5 elapsed seconds")
})

test("rate review preserves both phrase actions within one sentence", () => {
  const words = "We need more time now.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
  const segments = segmentWords(words)
  const marks = [
    { first: 0, last: 1, start: 0, end: 1.8, text: "We need", rule: "RATE_IMPORTANCE_SLOW" as const, articulationRate: 2.5 },
    { first: 2, last: 3, start: 2, end: 3.8, text: "more time", rule: "RATE_IMPORTANCE_FAST" as const, articulationRate: 8.5 },
  ]
  const findings = rateReview(segments, marks, "We need time").assessments[0].findings
  assert.equal(findings.length, 2)
  assert.deepEqual(findings.map(f => [f.rule_id, f.start, f.end]), [["RATE_IMPORTANCE_SLOW", 0, 1.8], ["RATE_IMPORTANCE_FAST", 2, 3.8]])
  assert.equal(findings[0].observation, "This passage moves slowly.")
  assert.equal(findings[1].observation, "This passage moves quickly.")
  assert.deepEqual(findings.map(f => f.text), ["We need", "more time"])
})

test("an adjustment crossing segment boundaries retains a precise span in each segment", () => {
  const words = "One. Two three.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
  const marks = [{ first: 0, last: 1, start: 0, end: 1.8, text: "One. Two", rule: "RATE_IMPORTANCE_FAST" as const, articulationRate: 8.5 }]
  const findings = rateReview(segmentWords(words), marks, "").assessments[0].findings
  assert.deepEqual(findings.map(f => [f.segment_id, f.start, f.end]), [["segment-1", 0, .8], ["segment-2", 1, 1.8]])
})

test("insufficient evidence stays uncertain rather than effective", () => {
  const words = "This is one complete passage.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
  const segments = segmentWords(words)
  assert.equal(rateReview(segments, [], "", "uncertain").assessments[0].verdict, "uncertain")
  assert.equal(rateReview(segments, []).assessments[0].verdict, "effective")
  assert.equal(rateReview(segments, []).assessments.find(a => a.foundation === "pauses")?.verdict, "uncertain")
})
