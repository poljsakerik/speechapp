import assert from "node:assert/strict"
import { test } from "node:test"
import type { Importance, MarkedWord } from "./importance.ts"
import { DEFAULT_RATE_CONFIG, detectRate, ratePhrases, syllables } from "./rate.ts"

type Part = [text: string, importance: Importance, pace?: number, pauseBefore?: number]

/** Words spoken one after another at `pace` × the 0.25 s per syllable reference, with an optional pause before each part. */
function speak(parts: Part[]): MarkedWord[] {
  let t = 0
  return parts
    .flatMap(([text, importance, pace = 1, pauseBefore = 0]) => {
      t += pauseBefore
      return text.split(" ").map((word) => {
        const start = t
        t += syllables(word) * 0.25 * pace
        return { text: word, start, end: t, importance, index: 0 }
      })
    })
    .map((w, index) => ({ ...w, index }))
}

/** A sentence of about 16 syllables. */
const said = (pace: number, pauseBefore = 0.35): Part => ["we went through the numbers on the call together again.", "unimportant", pace, pauseBefore]
/** Speech whose pace swings from phrase to phrase, so it never sounds monotone. */
const varied = (n: number): Part[] => Array.from({ length: n }, (_, i) => said([0.8, 1.2, 0.9, 1.15][i % 4]))
const rules = (words: MarkedWord[], config = {}) => detectRate(words, config).marks.map((m) => [m.rule, m.text])

test("flags a less important phrase dragged far past normal pace, not a mildly slow one", () => {
  const words = speak([...varied(4), ["and then we talked about it for a while.", "unimportant", 2, 0.35], ...varied(4), ["and so on and so forth.", "unimportant", 1.3, 0.35], ...varied(4)])
  assert.deepEqual(rules(words), [["RATE_IMPORTANCE_SLOW", "and then we talked about it for a while."]])
})

test("flags a rushed message phrase only when nothing else emphasizes it", () => {
  const rushed = speak([...varied(4), ["sales fell by half.", "important", 0.8, 0.35], ...varied(4)])
  assert.deepEqual(rules(rushed), [["RATE_IMPORTANCE_FAST", "sales fell by half."]])
  const paused = speak([...varied(4), ["sales fell by half.", "important", 0.8, 1], ...varied(4)])
  assert.deepEqual(rules(paused), [])
})

test("with message labels, only message phrases can be rushed and only unimportant ones dragged", () => {
  const words = speak([
    ...varied(4),
    ["sales fell by half.", "message", 0.8, 0.35],
    ...varied(2),
    ["the whole team gasped out loud.", "important", 0.7, 0.35],
    ...varied(2),
    ["and nobody said a single word for the rest of the day.", "important", 2, 0.35],
    ...varied(4),
  ])
  assert.deepEqual(rules(words), [["RATE_IMPORTANCE_FAST", "sales fell by half."]])
})

test("flags a monotone stretch with where to slow down and speed up", () => {
  const flat: Part[] = Array.from({ length: 6 }, () => said(1))
  const words = speak([...flat, ["sales fell by half.", "important", 1, 0.35], ...flat])
  const [mark, ...rest] = detectRate(words).marks
  assert.equal(rest.length, 0)
  assert.equal(mark.rule, "RATE_MONOTONE")
  assert.equal(mark.slowDown?.text, "sales fell by half.")
  assert.equal(mark.speedUp?.text, "we went through the numbers on the call together again.")
  assert.deepEqual(rules(speak(varied(13))), [])
})

test("keeps only the biggest outliers per minute", () => {
  const drag = (pace: number): Part => ["and then we talked about it for a while.", "unimportant", pace, 0.35]
  const words = speak([...varied(3), drag(1.6), ...varied(3), drag(2.5), ...varied(3), drag(1.8), ...varied(3)])
  const { marks } = detectRate(words, { marksPerMinute: 1 })
  assert.equal(marks.length, 1)
  assert.equal(marks[0].ratio.toFixed(1), "2.5")
})

test("fillers and the time they take are left out", () => {
  const words = speak([...varied(4), ["the result", "unimportant", 1, 0.35], ["um um um", "filler", 4], ["was clear.", "unimportant"], ...varied(4)])
  assert.deepEqual(rules(words), [])
})

test("counts syllables", () => {
  assert.deepEqual(["a", "gambling.", "possible", "divorce", "people", "300", "the"].map(syllables), [1, 2, 3, 2, 2, 4, 1])
})

test("a long filler cannot masquerade as an emphasis pause or add articulation time", () => {
  const words = speak([...varied(4), ["the result", "unimportant"], ["um", "filler", 8], ["sales fell by half.", "message", 0.8], ...varied(10)])
  const phrases = ratePhrases(words, DEFAULT_RATE_CONFIG)
  const point = phrases.find((p) => p.importance === "message")!
  assert.equal(point.pauseBefore, 0)
  assert.equal(phrases.find((p) => p.words.map((w) => w.text).join(" ") === "the result")!.pauseAfter, 0)
  assert.ok(detectRate(words).marks.some((m) => m.rule === "RATE_IMPORTANCE_FAST"))
  const withSilence = speak([["the result", "unimportant"], ["um", "filler", 8, 0.8], ["sales fell by half.", "message", 0.8], ...varied(10)])
  assert.equal(ratePhrases(withSilence, DEFAULT_RATE_CONFIG).find((p) => p.importance === "message")!.pauseBefore.toFixed(1), "0.8")
})
