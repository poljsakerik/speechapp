import assert from "node:assert/strict"
import { test } from "node:test"
import type { Word } from "./types.ts"
import { detectRate, syllables, type RateAnalysis } from "./rate.ts"
import { applyRateReview, contextCandidates, rateReviewRequest, reviewRate } from "./rate-review.ts"
import { openaiCompletion } from "./openai.ts"

function speech(durations: number[], gap = 0): Word[] {
  let t = 0
  return durations.map((duration, i) => {
    const start = t; t += duration
    const word = { text: i % 10 === 9 ? "day." : "day", start, end: t }; t += gap
    return word
  })
}
const respond = (a: RateAnalysis, decision: "keep" | "dismiss" | "uncertain") => ({ decisions: contextCandidates(a).map(c => ({ id: c.id, decision, first: c.first, last: c.last, reason: "Measured pattern checked in context." })) })

test("counts pronunciation syllables and spoken numbers instead of digits", () => {
  assert.deepEqual(["300", "100", "times", "people", "performing", "0.03%"].map(syllables), [3, 3, 1, 2, 3, 8])
})
test("cadence stays even when longer words take proportionally longer to say", () => {
  let time = 0
  const words = Array.from({ length: 60 }, (_, i) => {
    const text = Math.floor(i / 10) % 2 ? "people" : "day"
    const start = time; time += syllables(text) / 5
    return { text: i % 10 === 9 ? `${text}.` : text, start, end: time }
  })
  const analysis = detectRate(words)
  assert.ok(Math.abs(analysis.speakingRate! - 5) < 1e-10)
  const even = analysis.candidates.find(c => c.rule === "RATE_VARIATION")
  assert.ok(even, "word lengths must not manufacture pace changes")
  assert.ok(even.cadenceRates!.every(rate => Math.abs(rate - 5) < 1e-10))
  assert.ok(!analysis.candidates.some(c => c.rule === "RATE_REPETITIVE"))
})
test("sustained rushing and dragging generate candidates without importance labels", () => {
  const fast = detectRate(speech(Array(70).fill(.1)))
  assert.ok(fast.candidates.some(c => c.rule === "RATE_IMPORTANCE_FAST"))
  const slow = detectRate(speech(Array(30).fill(.6)))
  assert.ok(slow.candidates.some(c => c.rule === "RATE_IMPORTANCE_SLOW"))
  assert.ok(fast.candidates.every(c => c.last - c.first >= 2 && c.end - c.start >= 5))
})
test("a brief fast burst is not sustained rushing", () => {
  const words = speech([...Array(20).fill(.22), ...Array(5).fill(.1), ...Array(20).fill(.22)])
  assert.ok(!detectRate(words).candidates.some(c => c.rule === "RATE_IMPORTANCE_FAST"))
  const interrupted = speech([...Array(20).fill(.1), ...Array(10).fill(.2), ...Array(30).fill(.1)])
  assert.ok(!detectRate(interrupted).candidates.some(c => c.rule === "RATE_IMPORTANCE_FAST"), "separate bursts cannot be added into one sustained rush")
})
test("measured silence distinguishes articulation from experienced pace without removing fillers", () => {
  const words = speech(Array(35).fill(.2), .3)
  const pauses = words.slice(0, -1).map((w, i) => ({ start: w.end!, end: words[i + 1].start! }))
  const a = detectRate(words, {}, pauses)
  assert.ok(a.articulationRate! > a.speakingRate! * 2)
  const smeared = words.map((w, i) => ({ ...w, end: words[i + 1]?.start ?? w.end }))
  assert.ok(Math.abs(detectRate(smeared, {}, pauses).articulationRate! - a.articulationRate!) < .01)
  assert.equal(detectRate(words, {}, [...pauses, ...pauses]).articulationRate, a.articulationRate, "overlapping silence cannot be subtracted twice")
  const fillers = words.map((w, i) => ({ ...w, text: i % 7 === 0 ? "um" : w.text }))
  assert.equal(detectRate(fillers, {}, pauses).phrases[0].first, 0)
})
test("steady and periodically repeated pacing differ from irregular pace", () => {
  const even = detectRate(speech(Array(60).fill(.2)))
  assert.ok(even.candidates.some(c => c.rule === "RATE_VARIATION"))
  const irregular = detectRate(speech(Array.from({ length: 60 }, (_, i) => [.14, .35, .2, .45, .16, .27][Math.floor(i / 10)])))
  assert.ok(!irregular.candidates.some(c => c.rule === "RATE_REPETITIVE"))
  const repeated = detectRate(speech(Array.from({ length: 80 }, (_, i) => Math.floor(i / 10) % 2 ? .35 : .2)))
  assert.ok(repeated.candidates.some(c => c.rule === "RATE_REPETITIVE"))
  const mild = detectRate(speech(Array.from({ length: 60 }, (_, i) => [1 / 7.14, 1 / 5.26, 1 / 6.19, 1 / 5.33, 1 / 6.52, 1 / 5.46][Math.floor(i / 10)])))
  assert.ok(!mild.candidates.some(c => c.rule === "RATE_REPETITIVE"), "one large contrast cannot turn several mild fluctuations into a repeated pattern")
})
test("even-cadence windows and blocks can be tuned without changing measurements", () => {
  const words = speech(Array(60).fill(.2))
  const defaults = detectRate(words)
  const tuned = detectRate(words, { maxEvenWords: 40, cadenceBlockWords: 10 })
  const original = defaults.candidates.find(c => c.rule === "RATE_VARIATION")!
  const shorter = tuned.candidates.find(c => c.rule === "RATE_VARIATION")!
  assert.equal(original.last - original.first + 1, 45)
  assert.equal(shorter.last - shorter.first + 1, 40)
  assert.equal(original.cadenceRates!.length, 9)
  assert.equal(shorter.cadenceRates!.length, 4)
  assert.deepEqual(tuned.phrases, defaults.phrases)
  assert.deepEqual(tuned.pace, defaults.pace)
  for (const config of [{ minEvenWords: 61 }, { minEvenSeconds: 20 }]) {
    assert.ok(!detectRate(words, config).candidates.some(c => c.rule === "RATE_VARIATION"))
  }
})
test("sustained group windows and repetition lag control the evidence required", () => {
  const fast = speech(Array(70).fill(.1))
  assert.ok(detectRate(fast).candidates.some(c => c.rule === "RATE_IMPORTANCE_FAST"))
  assert.ok(!detectRate(fast, { maxGroupPhrases: 2 }).candidates.some(c => c.rule === "RATE_IMPORTANCE_FAST"))
  const repeated = speech(Array.from({ length: 80 }, (_, i) => Math.floor(i / 10) % 2 ? .35 : .2))
  assert.ok(detectRate(repeated).candidates.some(c => c.rule === "RATE_REPETITIVE"))
  assert.ok(!detectRate(repeated, { repetitionLagPhrases: 1 }).candidates.some(c => c.rule === "RATE_REPETITIVE"))
})
test("local speed and flow evidence thresholds can be tuned independently", () => {
  const relative = speech([...Array(20).fill(.5), ...Array(20).fill(.3)])
    .map(w => ({ ...w, text: w.text.replace("day", "people") }))
  assert.ok(detectRate(relative).candidates.some(c => c.pattern === "relative-fast"))
  assert.ok(!detectRate(relative, { minRelativeSyllables: 21 }).candidates.some(c => c.pattern === "relative-fast"))
  const interrupted = speech(Array(20).fill(.2), .4)
  assert.ok(detectRate(interrupted).candidates.some(c => c.rule === "RATE_FLOW"))
  assert.ok(!detectRate(interrupted, { minFlowPauses: 10 }).candidates.some(c => c.rule === "RATE_FLOW"))
})
test("context review preserves exact highlights and rejects fabricated or escaped decisions", async () => {
  const words = speech(Array(200).fill(.1)), analysis = detectRate(words)
  analysis.candidates.forEach(c => { c.pattern = "relative-fast" })
  let requests = 0
  const result = await reviewRate(words, analysis, async request => {
    requests++
    assert.ok(request.user.includes("Full original lecture"))
    assert.ok(!request.user.includes("golden"))
    return respond(analysis, "keep")
  }, "Full original lecture")
  assert.equal(requests, 1, "all contextual candidates share one full-context request")
  assert.ok(result.marks.length)
  for (const mark of result.marks) {
    assert.equal(mark.start, words[mark.first].start)
    assert.equal(mark.end, words[mark.last].end)
    assert.equal(mark.text, words.slice(mark.first, mark.last + 1).map(w => w.text).join(" "))
  }
  assert.throws(() => applyRateReview(analysis, { decisions: [] }), /cover every/)
  const bad = respond(analysis, "keep"); bad.decisions[0].first = -1
  assert.throws(() => applyRateReview(analysis, bad), /Invalid/)
  const cropped = respond(analysis, "keep"); cropped.decisions[0].last--
  assert.throws(() => applyRateReview(analysis, cropped), /Invalid/, "cropping invalidates the measured span")
  const unknown = respond(analysis, "keep"); unknown.decisions[0].id = "made-up"
  assert.throws(() => applyRateReview(analysis, unknown), /Invalid/)
  assert.equal(applyRateReview(analysis, respond(analysis, "uncertain")).status, "uncertain")
  assert.deepEqual(applyRateReview(analysis, respond(analysis, "dismiss")).marks, [])
})
test("short or invalid timing is uncertain, not a clean assessment; no model call is made", async () => {
  const words = speech([.3, .3, .3]), analysis = detectRate(words)
  const result = await reviewRate(words, analysis, async () => { throw new Error("must not be called") })
  assert.equal(result.status, "uncertain")
  assert.equal(detectRate(speech(Array(120).fill(.05))).reliable, false, "no usable phrase measurements cannot certify clean speech")
  assert.equal(detectRate([...words].reverse()).reliable, false)
  assert.equal(detectRate([{ text: "hello", start: NaN, end: 2 }]).reliable, false)
  assert.notEqual(rateReviewRequest(words, analysis, "context A").user, rateReviewRequest(words, analysis, "context B").user)
})

test("sustained measured patterns keep their evidence span without a language-model veto", async () => {
  const words = speech(Array(70).fill(.1)), analysis = detectRate(words)
  const result = await reviewRate(words, analysis, openaiCompletion({ apiKey: "" }))
  assert.ok(result.marks.length)
  assert.ok(result.marks.every(m => analysis.candidates.some(c => c.first === m.first && c.last === m.last)))
})
