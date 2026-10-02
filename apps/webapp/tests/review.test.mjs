import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyReviewMessage, normalizeReview } from "../src/lib/review.ts"

const words = "We need more time now.".split(" ").map((text, i) => ({ text, start: i, end: i + .8 }))
const segments = [{ id: "s1", start: 0, end: 4.8, words, text: "We need more time now." }]
const raw = (range) => ({ assessments: [{ foundation: "rate", findings: [{ segment_id: "s1", observation: "Slow down on more time", ...range }] }] })
test("empty feedback distinguishes an inconclusive review from no detected rate issues", () => {
  const uncertain = normalizeReview({ assessments: [{ foundation: "rate", verdict: "uncertain" }] }, segments)
  assert.match(emptyReviewMessage(uncertain.assessments), /enough reliable evidence/)
  assert.equal(emptyReviewMessage([]), emptyReviewMessage(uncertain.assessments))
  const reviewed = normalizeReview({ assessments: [{ foundation: "rate", verdict: "effective" }] }, segments)
  assert.match(emptyReviewMessage(reviewed.assessments), /No rate-of-speech issues were flagged/)
  assert.match(emptyReviewMessage(reviewed.assessments), /other four fundamentals haven’t been assessed/)
  const both = normalizeReview({ assessments: [{ foundation: "rate", verdict: "effective" }, { foundation: "pauses", verdict: "effective" }, { foundation: "volume", verdict: "uncertain" }] }, segments)
  assert.equal(emptyReviewMessage(both.assessments), "No rate-of-speech or pause issues were flagged. The other three fundamentals haven’t been assessed.")
})
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

test("a connected passage split by ASR gets one note and complete replay without bridging unmarked words", () => {
  const parts = [
    { id: "a", start: 0, end: 1.8, words: words.slice(0, 2), text: "We need" },
    { id: "b", start: 2, end: 4.8, words: words.slice(2), text: "more time now." },
  ]
  const findings = [
    { segment_id: "a", group_id: "0", rule_id: "RATE_FLOW", start: 0, end: 1.8, observation: "Carry this thought forward" },
    { segment_id: "b", group_id: "0", rule_id: "RATE_FLOW", start: 2, end: 4.8, observation: "Carry this thought forward" },
  ]
  const review = () => normalizeReview({ assessments: [{ foundation: "rate", findings }] }, parts)
  assert.equal(review().findings.length, 1)
  assert.deepEqual(review().findings[0].span, [0, 4.8])
  findings[1].start = 3
  assert.equal(review().findings.length, 2, "an unmarked word between spans must stay unmarked")
})
test("pause pointers survive normalization; unknown directions are dropped", () => {
  const review = normalizeReview({ assessments: [{ foundation: "pauses", findings: [{ segment_id: "s1", observation: "Runs on", start: 0, end: 4.8, suggestions: [
    { direction: "pause_after", start: 1, end: 1.8, text: "need" }, { direction: "no_pause_after", start: 2, end: 2.8, text: "more" }, { direction: "shout", start: 3, end: 3.8, text: "time" },
  ] }] }] }, segments)
  assert.deepEqual(review.findings[0].suggestions.map(s => s.direction), ["pause_after", "no_pause_after"])
})
