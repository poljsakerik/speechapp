import assert from "node:assert/strict"
import { test } from "node:test"
import type { Word } from "./types.ts"
import { detectRate, syllables } from "./rate.ts"

/** One-syllable words, each lasting `seconds`, with `gap` seconds of silence after it. */
function speech(durations: number[], gap = 0): Word[] {
  let t = 0
  return durations.map((duration, i) => {
    const start = t; t += duration
    const word = { text: i % 10 === 9 ? "day." : "day", start, end: t }; t += gap
    return word
  })
}
const rules = (words: Word[], config = {}, pauses: { start: number; end: number }[] = []) => detectRate(words, config, pauses).marks.map(m => m.rule)
const gaps = (words: Word[]) => words.slice(1).map((w, i) => ({ start: words[i].end!, end: w.start! }))

test("counts pronunciation syllables and spoken numbers instead of digits", () => {
  assert.deepEqual(["300", "100", "times", "people", "performing", "0.03%"].map(syllables), [3, 3, 1, 2, 3, 8])
})
test("sustained rushing and dragging are flagged; an everyday pace is not", () => {
  assert.deepEqual(rules(speech(Array(200).fill(.1))), ["RATE_IMPORTANCE_FAST"], "10 syllables/s")
  assert.deepEqual(rules(speech(Array(40).fill(.5))), ["RATE_IMPORTANCE_SLOW"], "2 syllables/s")
  assert.deepEqual(rules(speech(Array(100).fill(.2))), [], "5 syllables/s")
  const [mark] = detectRate(speech(Array(200).fill(.1))).marks
  assert.equal(mark.first, 0)
  assert.equal(mark.last, 199, "overlapping windows form one passage")
  assert.ok(Math.abs(mark.articulationRate - 10) < 1e-9)
})
test("longer words taking proportionally longer are not a pace change", () => {
  let t = 0
  const words = Array.from({ length: 100 }, (_, i) => {
    const text = Math.floor(i / 10) % 2 ? "people" : "day", start = t
    t += syllables(text) / 5
    return { text, start, end: t }
  })
  const analysis = detectRate(words)
  assert.ok(Math.abs(analysis.articulationRate! - 5) < 1e-9)
  assert.deepEqual(analysis.marks, [])
})
test("a brief burst inside everyday speech is not sustained rushing", () => {
  const words = speech([...Array(75).fill(.2), ...Array(50).fill(.1), ...Array(75).fill(.2)])
  assert.deepEqual(rules(words), [], "5 s at 10 syllables/s within 30 s at 5")
})
test("pauses never decide rate: they are a separate fundamental", () => {
  const paused = speech(Array(100).fill(.2), .8)
  const pauses = gaps(paused)
  const analysis = detectRate(paused, {}, pauses)
  assert.ok(Math.abs(analysis.articulationRate! - 5) < 1e-9, "articulation excludes silence")
  assert.ok(analysis.speakingRate! < 2, "speaking rate includes it")
  assert.deepEqual(analysis.marks, [], "long pauses alone are not dragging")
  const rushedWithPauses = speech(Array(200).fill(.1), .3)
  assert.deepEqual(rules(rushedWithPauses, {}, gaps(rushedWithPauses)), ["RATE_IMPORTANCE_FAST"], "pausing does not excuse rushed words")
  // Recognizers stretch words over silence; a measured pause removes it again.
  const smeared = paused.map((w, i) => ({ ...w, end: paused[i + 1]?.start ?? w.end }))
  assert.ok(Math.abs(detectRate(smeared, {}, pauses).articulationRate! - 5) < 1e-9)
  assert.equal(detectRate(paused, {}, [...pauses, ...pauses]).articulationRate, analysis.articulationRate, "overlapping silence is not subtracted twice")
  const fillers = paused.map((w, i) => ({ ...w, text: i % 7 === 0 ? "um" : w.text }))
  assert.equal(detectRate(fillers, {}, pauses).articulationRate, analysis.articulationRate, "fillers stay speech")
})
test("music or noise absorbed into a word's timing is not slow speech", () => {
  const words = speech(Array(100).fill(.2))
  // The aligner closes gaps that are not silent, so a song after the last word stretches it.
  const sung = [...words.slice(0, -1), { ...words.at(-1)!, end: words.at(-1)!.end! + 18 }]
  assert.deepEqual(rules(sung), [])
  assert.ok(Math.abs(detectRate(sung).articulationRate! - 100 / 20.8) < 1e-9, "the word keeps at most 1 s per syllable")
})
test("a clip shorter than the sustained window is judged as a whole", () => {
  assert.deepEqual(rules(speech(Array(90).fill(.1))), ["RATE_IMPORTANCE_FAST"], "9 s of speech")
  assert.deepEqual(rules(speech(Array(90).fill(.1)), { fastRate: 11 }), [], "thresholds are configurable")
})
test("too little or implausible speech is uncertain, not a clean assessment", () => {
  assert.equal(detectRate(speech(Array(40).fill(.1))).reliable, false, "4 s of speech")
  assert.equal(detectRate(speech(Array(120).fill(.05))).reliable, false, "20 syllables/s means the timing is wrong")
  assert.equal(detectRate([...speech(Array(100).fill(.2))].reverse()).reliable, false)
  assert.equal(detectRate([{ text: "hello", start: NaN, end: 2 }]).reliable, false)
  assert.deepEqual(detectRate(speech(Array(40).fill(.1))).marks, [])
})
