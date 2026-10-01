import assert from "node:assert/strict"
import { test } from "node:test"
import { detectPauses, type PauseMark } from "@micmane/vocal-processing/pauses"
import { deliveryReview, segmentWords } from "./review.ts"

const words = [
  { text: "Revenue", start: 0, end: 0.4, index: 0, importance: "message" as const },
  { text: "doubled.", start: 0.4, end: 0.8, index: 1, importance: "message" as const },
  { text: "Next", start: 0.8, end: 1.2, index: 2, importance: "unimportant" as const },
  { text: "topic.", start: 1.2, end: 1.6, index: 3, importance: "unimportant" as const },
]

test("pins a necessary pause between words across segments and merges related rate advice", () => {
  const pauses = detectPauses(words, [{ after: 1, placement: "processing", confidence: "clear" }])
  const rate = { rule: "RATE_IMPORTANCE_FAST" as const, first: 0, last: 1, start: 0, end: 0.8, text: "Revenue doubled.", impact: 0.5, ratio: 0.8 }
  const review = deliveryReview(segmentWords(words), [rate], pauses, "Revenue doubled.")
  const findings = review.assessments.flatMap((a) => a.findings)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].at, 0.8)
  assert.deepEqual(findings[0].span, [0.4, 0.8])
  assert.deepEqual(findings[0].related_rule_ids, ["RATE_IMPORTANCE_FAST"])
  assert.equal(findings[0].rule_id, "PAUSE_NECESSARY")
  assert.ok(review.assessments.filter((a) => ["volume", "pitch_melody", "tonality"].includes(a.foundation)).every((a) => a.verdict === "uncertain"))
})

test("filler and unnecessary pause remain separate measurements but share displayed advice", () => {
  const input = words.map((w, i) => ({ ...w, text: i === 0 ? "Um" : w.text, importance: i === 0 ? "filler" as const : w.importance }))
  input[0].end = 0.1
  for (const word of input.slice(1)) { word.start += 0.6; word.end += 0.6 }
  const pauses = detectPauses(input, [{ after: 0, placement: "connected", confidence: "clear" }], { marksPerMinute: 100 })
  const review = deliveryReview(segmentWords(input), [], pauses, "")
  assert.equal(pauses.candidates.length, 2)
  const findings = review.assessments.flatMap((a) => a.findings)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule_id, "PAUSE_FILLERS")
  assert.deepEqual(findings[0].related_rule_ids, ["PAUSE_UNNECESSARY"])
})

test("absence of detected fillers or boundary evidence does not claim fluent delivery", () => {
  const review = deliveryReview(segmentWords(words), [], detectPauses(words, []), "")
  assert.equal(review.assessments.find((a) => a.foundation === "pauses")?.verdict, "uncertain")
})

test("a finding on a word at a segment seam belongs to the segment containing that word", () => {
  const input = words.map((w, i) => ({ ...w, importance: i === 2 ? "filler" as const : w.importance }))
  const review = deliveryReview(segmentWords(input), [], detectPauses(input, []), "")
  assert.equal(review.assessments.flatMap((a) => a.findings)[0].segment_id, "segment-2")
})

test("live review presents at most three priority changes", () => {
  const pauses = detectPauses(words, [])
  pauses.marks = Array.from({ length: 5 }, (_, i): PauseMark => ({ rule: "PAUSE_FILLERS", first: 0, last: 0, start: 0, end: 0.4, at: 0, text: "Revenue", observedSeconds: 0.4, impact: i }))
  const review = deliveryReview(segmentWords(words), [], pauses, "")
  assert.equal(review.assessments.flatMap((a) => a.findings).length, 3)
})
