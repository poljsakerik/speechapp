import assert from "node:assert/strict"
import { test } from "node:test"
import { measurePace } from "./pace.ts"

function sample(gaps: Record<number, number> = {}) {
  let time = 0
  return Array.from({ length: 40 }, (_, i) => {
    const start = time; time += .3
    const word = { text: i % 10 === 9 ? "day." : "day", start, end: time }
    time += gaps[i] ?? 0
    return word
  })
}

test("the rolling curve counts syllables rather than words", () => {
  const mono = measurePace(sample())
  const multi = measurePace(sample().map(w => ({ ...w, text: w.text.replace("day", "people") })))
  for (const [i, point] of multi.curve.entries()) {
    assert.equal(point.speakingRate, mono.curve[i].speakingRate * 2)
    assert.equal(point.articulationRate, mono.curve[i].articulationRate == null ? null : mono.curve[i].articulationRate! * 2)
  }
})

test("pauses lower the speaking rate but leave a gap in articulation", () => {
  const spaced = measurePace(sample({ 9: 2, 19: 2, 29: 2 }))
  assert.equal(spaced.pauses.length, 3)
  assert.ok(spaced.curve.some(p => p.paused && p.articulationRate === null && p.speakingRate < 2.5))
})

test("the curve unions measured silence and word gaps, and rejects invalid timing", () => {
  const words = sample({ 5: 1 }), pause = { start: words[5].end, end: words[6].start }
  assert.deepEqual(measurePace(words, [pause, pause]), measurePace(words, [pause]))
  const smeared = words.map((w, i) => i === 5 ? { ...w, end: words[6].start } : w)
  assert.deepEqual(measurePace(smeared, [pause]).curve, measurePace(words, [pause]).curve)
  assert.deepEqual(measurePace([{ text: "word", start: 1, end: 0 }]).curve, [])
})
