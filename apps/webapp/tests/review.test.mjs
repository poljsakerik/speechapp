import assert from "node:assert/strict"
import { test } from "node:test"
import { normalizeReview } from "../src/lib/review.ts"

const words = "We need more time now.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
const segments = [{ id: "s1", start: 0, end: 4.8, words, text: "We need more time now." }]
const raw = (range) => ({ assessments: [{ foundation: "rate", findings: [{ segment_id: "s1", observation: "Slow down on more time", ...range }] }] })
test("phrase feedback seeks to and highlights only its words", () => {
  const finding = normalizeReview(raw({ start: 2, end: 3.8 }), segments).findings[0]
  assert.equal(finding.at, 2)
  assert.deepEqual(finding.span, [2, 3.8])
})
test("absent or invalid phrase bounds fall back safely to the segment", () => {
  for (const range of [{}, { start: -1, end: 3.8 }, { start: 2, end: 100 }, { start: 3, end: 2 }, { start: NaN, end: 3 }]) {
    const finding = normalizeReview(raw(range), segments).findings[0]
    assert.equal(finding.at, 0)
    assert.equal(finding.span, undefined)
  }
})
