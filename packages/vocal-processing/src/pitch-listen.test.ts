import assert from "node:assert/strict"
import { test } from "node:test"
import { chunkTimes, listenForPitch, parseHeard } from "./pitch-listen.ts"

test("long audio is cut halfway between words, at the first gap 30 s on", () => {
  const words = Array.from({ length: 40 }, (_, i) => ({ text: "day", start: i * 2, end: i * 2 + 1.5 }))
  assert.deepEqual(chunkTimes(words, 81, 30), [[0, 29.75], [29.75, 59.75], [59.75, 81]])
})

test("replies keep well-formed problems, clamped to the chunk, and reject a missing list", () => {
  const ok = { start: 2, end: 40, issue: "monotone", severity: 2, how: " Flat. ", fix: "Move." }
  assert.deepEqual(parseHeard({ problems: [ok, { ...ok, issue: "loud" }, { ...ok, start: 5, end: 5 }, { ...ok, severity: 2.5 }] }, 30),
    [{ start: 2, end: 30, issue: "monotone", severity: 2, how: "Flat.", fix: "Move." }])
  assert.throws(() => parseHeard({}, 30), /no problems list/)
})

test("each chunk is sent as WAV and its stretches come back in recording time", async () => {
  const words = Array.from({ length: 40 }, (_, i) => ({ text: "day", start: i * 2, end: i * 2 + 1.5 }))
  const sent: number[] = []
  const heard = await listenForPitch(new Float32Array(81 * 1000), 1000, words, async ({ wav }) => {
    sent.push((wav.length - 44) / 2000)
    return { problems: [{ start: 1, end: 2, issue: "too_high", severity: 1, how: "Squeaky.", fix: "Lower it." }] }
  }, { concurrency: 2 })
  assert.deepEqual(sent.sort((a, b) => a - b), [21.25, 29.75, 30])
  assert.deepEqual(heard.map(h => h.start), [1, 30.75, 60.75])
})
