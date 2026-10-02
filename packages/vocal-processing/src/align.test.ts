import assert from "node:assert/strict"
import { test } from "node:test"
import { numberWords, refineTimings, resample, spell, viterbiAlign, type Emission } from "./align.ts"

const LETTERS = ["<pad>", "<s>", "</s>", "<unk>", "|", "E", "T", "A", "O", "N", "I", "H", "S", "R", "D", "L", "U", "M", "W", "C", "F", "G", "Y", "P", "B", "V", "K", "'", "X", "J", "Q", "Z"]

/** An emission that is confidently `frames[t]` at each frame: a letter, "|" or "-" for blank. */
function emission(frames: string[]): Emission {
  const logProbs = new Float32Array(frames.length * LETTERS.length).fill(-10)
  frames.forEach((ch, t) => { logProbs[t * LETTERS.length + (ch === "-" ? 0 : LETTERS.indexOf(ch))] = 0 })
  return { logProbs, frames: frames.length }
}

test("spells words in the model's alphabet, with numbers read out", () => {
  assert.deepEqual(spell("it's").map((i) => LETTERS[i]).join(""), "IT'S")
  assert.equal(numberWords("1992"), "nineteen ninety two")
  assert.equal(numberWords("300"), "three hundred")
  assert.equal(numberWords("0.03"), "zero point zero three")
  assert.deepEqual(spell("10x").map((i) => LETTERS[i]).join(""), "TEN|X")
  assert.deepEqual(spell("—"), [])
})

test("aligns words to the frames that spell them, even when the recognizer's times are off", () => {
  // "go" at frames 2-3, a pause, "on" at frames 8-9 (20 ms frames).
  const em = emission(["-", "-", "G", "O", "-", "-", "-", "-", "O", "N", "-", "-"])
  const words = [{ text: "Go", start: 0, end: 0.12 }, { text: "on.", start: 0.12, end: 0.24 }]
  const aligned = viterbiAlign(words, em)
  assert.deepEqual(aligned.map((w) => [w.start, w.end].map((x) => Math.round(x! * 100))), [[4, 8], [16, 20]])
  // Words without letters keep their times.
  const withDash = viterbiAlign([words[0], { text: "—", start: 0.1, end: 0.12 }, words[1]], em)
  assert.deepEqual(withDash[1], { text: "—", start: 0.1, end: 0.12 })
})

test("refining closes gaps that aren't silent and trims words that run into a pause", () => {
  const words = [{ text: "a", start: 0, end: 0.1 }, { text: "b", start: 0.3, end: 1.2 }, { text: "c", start: 1.2, end: 1.4 }]
  const refined = refineTimings(words, [{ start: 0.8, end: 1.2 }])
  assert.deepEqual(refined.map((w) => [w.start, w.end]), [[0, 0.3], [0.3, 0.8], [1.2, 1.4]])
})

test("resamples by averaging", () => {
  assert.deepEqual([...resample(Float32Array.from([1, 1, 1, 4, 4, 4]), 48000, 16000)], [1, 4])
})
