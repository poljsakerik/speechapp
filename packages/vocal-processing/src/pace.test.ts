import assert from "node:assert/strict"
import { test } from "node:test"
import { boundaryAfter, measurePace } from "./pace.ts"
import { detectRate } from "./rate.ts"

function sample(gaps: Record<number, number> = {}, punctuation = true) {
  let time = 0
  return Array.from({ length: 40 }, (_, i) => {
    const start = time; time += .3
    const word = { text: punctuation && i % 10 === 9 ? "day." : "day", start, end: time }
    time += gaps[i] ?? 0
    return word
  })
}

test("boundary pauses reduce overall WPM without masquerading as slower articulation", () => {
  const fluent = measurePace(sample()), spaced = measurePace(sample({ 9: 2, 19: 2, 29: 2 }))
  assert.deepEqual(spaced.clauses.map(c => Math.round(c.articulationWpm)), fluent.clauses.map(c => Math.round(c.articulationWpm)))
  assert.ok(spaced.pauses.every(p => p.boundary === "sentence"))
  assert.ok(spaced.clauses.every(c => c.internalPauses.length === 0))
  assert.ok(spaced.curve.some(p => p.paused && p.articulationWpm === null && p.speakingWpm < 150))
  assert.ok(!detectRate(sample({ 9: 2, 19: 2, 29: 2 })).candidates.some(c => c.rule === "RATE_FLOW" || c.rule === "RATE_VARIATION"))
})

test("interruptions stay inside a clause and nominate flow separately from slow articulation", () => {
  const words = sample({ 2: 1.2, 5: 1.3, 12: .9, 15: .9 })
  const a = detectRate(words)
  const flow = a.candidates.find(c => c.rule === "RATE_FLOW")
  assert.ok(flow)
  assert.equal(flow.first, 0)
  assert.equal(flow.last, 19, "adjacent interrupted clauses are one connected finding")
  assert.ok(flow.articulationRate > 2.8)
  assert.equal(a.pace!.clauses[0].internalPauses.length, 2)
  assert.equal(a.pace!.clauses[0].last, 9, "a hesitation must not split the clause")
})

test("ASR punctuation is a clue; ellipses and decimals are not completed thoughts", () => {
  assert.equal(boundaryAfter("By..."), "within")
  assert.equal(boundaryAfter("he…"), "within")
  assert.equal(boundaryAfter("0.03%"), "within")
  assert.equal(boundaryAfter("however,"), "clause")
  assert.equal(boundaryAfter('done.”'), "sentence")
})

test("the curve unions measured silence and word gaps, and rejects invalid timing", () => {
  const words = sample({ 5: 1 }), pause = { start: words[5].end, end: words[6].start }
  assert.deepEqual(measurePace(words, [pause, pause]), measurePace(words, [pause]))
  const smeared = words.map((w, i) => i === 5 ? { ...w, end: words[6].start } : w)
  assert.deepEqual(measurePace(smeared, [pause]).curve, measurePace(words, [pause]).curve)
  assert.deepEqual(measurePace([{ text: "word", start: 1, end: 0 }]).curve, [])
})

test("local accelerations and slowdowns can be nominated without extreme absolute rates", () => {
  let time = 0
  const words = Array.from({ length: 160 }, (_, i) => {
    const clause = Math.floor(i / 20), duration = clause === 2 || clause === 3 ? .14 : clause === 5 || clause === 6 ? .3 : .2
    const start = time; time += duration
    return { text: i % 20 === 19 ? "day." : "day", start, end: time }
  })
  const a = detectRate(words)
  assert.ok(a.candidates.some(c => c.pattern === "relative-fast" && c.articulationRate < 8))
  assert.ok(a.candidates.some(c => c.pattern === "relative-slow" && c.articulationRate > 2.8))
})

test("a later acceleration does not manufacture a slowdown in the preceding steady delivery", () => {
  let time = 0
  const words = Array.from({ length: 140 }, (_, i) => {
    const start = time; time += i < 80 ? .3 : .14
    return { text: i % 20 === 19 ? "day." : "day", start, end: time }
  })
  assert.ok(!detectRate(words).candidates.some(c => c.pattern === "relative-slow" && c.first < 80))
})
