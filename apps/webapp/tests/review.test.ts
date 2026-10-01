import assert from "node:assert/strict"
import { test } from "node:test"
import { normalizeReview } from "../src/lib/review.ts"

const segments = [
  { id: "a", start: 0, end: 1, text: "A point.", words: [{ text: "A", start: 0, end: 0.4 }, { text: "point.", start: 0.4, end: 1 }] },
  { id: "b", start: 1.2, end: 2, text: "Next.", words: [{ text: "Next.", start: 1.2, end: 2 }] },
]
const review = (finding: object) => normalizeReview({ assessments: [{ foundation: "pauses", verdict: "mixed", findings: [{ segment_id: "a", rule_id: "PAUSE_NECESSARY", observation: "Give this point space.", ...finding }] }] }, segments)

test("preserves between-word pins and cross-segment word spans", () => {
  const [finding] = review({ at: 1, span: [0.4, 1.2], related_rule_ids: ["RATE_IMPORTANCE_FAST"] }).findings
  assert.equal(finding.at, 1)
  assert.deepEqual(finding.span, [0.4, 1.2])
  assert.deepEqual(finding.relatedRuleIds, ["RATE_IMPORTANCE_FAST"])
})

test("rejects fabricated spans and out-of-range pins, with a safe legacy fallback", () => {
  for (const data of [{ at: NaN, span: [0.7, 1.2] }, { at: 10, span: [0.4, 1.2] }, { at: -1 }, {}]) {
    assert.equal(review(data).findings[0].at, 0)
  }
  assert.equal(review({ span: [1.2, 0.4] }).findings[0].span, undefined)
  assert.equal(review({ span: [1.2, 1.2] }).findings[0].span, undefined)
  assert.deepEqual(review({ segment_id: "missing" }).findings, [])
})
