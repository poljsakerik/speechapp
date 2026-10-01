import assert from "node:assert/strict"
import { test } from "node:test"
import type { Word } from "./types.ts"
import { detectRate, syllables } from "./rate.ts"
import { pacingPhrases, type PacingPrediction } from "./pacing.ts"

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

/**
 * Twelve five-word sentences alternating key point (-2) and setup (+2), with
 * key words lasting `key` seconds and setup words `setup` seconds.
 */
function passage(key: number, setup: number) {
  let t = 0
  const words = Array.from({ length: 60 }, (_, i) => {
    const start = t
    t += Math.floor(i / 5) % 2 ? setup : key
    return { text: i % 5 === 4 ? "day." : "day", start, end: t }
  })
  const pacing: PacingPrediction = { phrases: pacingPhrases(words), scores: Array.from({ length: 12 }, (_, i) => i % 2 ? 2 : -2) }
  return { words, pacing }
}

test("a passage is flagged when its key points were not slower than the setup", () => {
  const flat = passage(.2, .2)
  const [mark] = detectRate(flat.words, {}, [], flat.pacing).marks
  assert.equal(mark.reason, "contrast")
  assert.equal(mark.rule, "RATE_IMPORTANCE_FAST")
  assert.deepEqual([mark.first, mark.last], [0, 59])
  assert.deepEqual(mark.suggestions!.map(s => s.direction), ["slow_down", "speed_up"])
  const inverted = passage(.17, .25)
  const [worse] = detectRate(inverted.words, {}, [], inverted.pacing).marks
  assert.deepEqual(worse.suggestions!.map(s => [s.direction, s.text]), [["slow_down", "day day day day day."], ["speed_up", "day day day day day."]])
  assert.ok(worse.suggestions!.every(s => s.last - s.first === 4), "each suggestion is one whole phrase")
})
test("key points spoken slower than the setup are left alone, for fast and slow talkers alike", () => {
  for (const scale of [.7, 1, 1.4]) {
    const good = passage(.25 * scale, .17 * scale)
    assert.deepEqual(detectRate(good.words, {}, [], good.pacing).marks, [])
    const flat = passage(.2 * scale, .2 * scale)
    assert.equal(detectRate(flat.words, {}, [], flat.pacing).marks.length, 1)
  }
})
test("without a pacing prediction the contrast check does not run", () => {
  const flat = passage(.2, .2)
  const analysis = detectRate(flat.words)
  assert.equal(analysis.contrast, false)
  assert.deepEqual(analysis.marks, [])
  assert.equal(detectRate(flat.words, {}, [], flat.pacing).contrast, true)
})
test("a passage needs at least two key and two setup phrases to judge", () => {
  const flat = passage(.2, .2)
  const scores = flat.pacing.scores.map((s, i) => i < 11 ? 2 : s)
  assert.deepEqual(detectRate(flat.words, {}, [], { ...flat.pacing, scores }).marks, [])
})
