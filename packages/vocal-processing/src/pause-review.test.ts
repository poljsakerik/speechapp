import assert from "node:assert/strict"
import { test } from "node:test"
import { confirmedPauses, parseReview, reviewParts, reviewPause, reviewRequest, stretches } from "./pause-review.ts"
import type { JsonCompletion } from "./types.ts"

/** Words of 0.2 s; `gaps` maps a word index to the measured silence after it. */
function take(texts: string[], gaps: Record<number, number>) {
  let t = 0
  const pauses: { start: number; end: number }[] = []
  const words = texts.map((text, i) => { const w = { text, start: t, end: t + 0.2 }; t += 0.2; if (gaps[i]) { pauses.push({ start: t, end: t + gaps[i] }); t += gaps[i] } return w })
  return { words, pauses }
}
const t = take("We looked at the data. It was clear that the plan had worked well for everyone involved.".split(" "), { 1: 0.6, 4: 3.4, 8: 0.7 })
const marked = [{ after: 1, seconds: 0.6 }, { after: 4, seconds: 3.4 }, { after: 8, seconds: 0.7 }]
const ids = (user: string) => [...user.matchAll(/P(\d+)(?=[,\n ]|$)/g)].map(m => Number(m[1]))
/** A reply giving each pause in the request `verdict(id)` and offering `missing` for every stretch it is asked about. */
const reply = (verdict: (id: number) => string, missing: number[] = []): JsonCompletion => async ({ user }) => {
  const asked = user.split("Review only")[1]
  return { pauses: [...new Set(ids(asked.split("\n")[0]))].map(id => ({ id, verdict: verdict(id) })), stretches: [...asked.matchAll(/S(\d+):/g)].map(m => ({ id: Number(m[1]), pause_after: missing })) }
}

test("every real pause is marked in place with its length, and every stretch without one is listed", () => {
  const { user } = reviewRequest(t.words, marked, () => 1)
  assert.match(user, /1:looked \[P0 0\.6s\] 2:at/)
  assert.match(user, /4:data\. \[P1 3\.4s\] 5:It/)
  assert.deepEqual(stretches(t.words, marked), [[0, 1], [2, 4], [5, 8], [9, 16]])
  assert.match(user, /S3: words 9-16, 1\.6s, 8 syllables/)
})

test("a reply must judge every pause asked about; missing pauses must sit inside a stretch", () => {
  assert.equal(parseReview(t.words, marked, { pauses: [{ id: 0, verdict: "fits" }], stretches: [] }), undefined)
  const ok = parseReview(t.words, marked, { pauses: [0, 1, 2].map(id => ({ id, verdict: "fits" })), stretches: [{ id: 3, pause_after: [12, 16, 4, 2.5] }] })
  assert.deepEqual(ok?.missing, [12], "16 ends the stretch, 4 is outside it, 2.5 is not a word")
})

test("long takes are reviewed in parts that never split a stretch", () => {
  const long = take(Array.from({ length: 300 }, (_, i) => `w${i}`), Object.fromEntries(Array.from({ length: 30 }, (_, k) => [k * 10 + 9, 0.5])))
  const pauses = Array.from({ length: 30 }, (_, k) => ({ after: k * 10 + 9, seconds: 0.5 }))
  const parts = reviewParts(long.words, pauses)
  assert.deepEqual(parts, [[0, 119], [120, 239], [240, 299]])
})

test("findings name their words and group by kind; a fitting pause yields nothing", async () => {
  const review = await reviewPause(t.words, t.pauses, reply(id => ["breaks", "too_long", "fits"][id], [12]))
  assert.equal(review.status, "reviewed")
  assert.deepEqual(review.marks.map(m => [m.rule, m.at]), [["PAUSE_UNNECESSARY", [1]], ["PAUSE_TOO_LONG", [4]], ["PAUSE_NECESSARY", [12]]])
  assert.deepEqual((await reviewPause(t.words, t.pauses, reply(() => "fits"))).marks, [])
})

test("without a model or a usable reply, pauses are not assessed rather than judged by fixed rules", async () => {
  assert.equal((await reviewPause(t.words, t.pauses)).status, "no model")
  assert.equal((await reviewPause(t.words, t.pauses, async () => { throw new Error("offline") })).reliable, false)
  assert.equal((await reviewPause(t.words, t.pauses, async () => ({ pauses: [], stretches: [] }))).status, "unusable reply")
})

test("a pause the two timings place at different words gets no finding", () => {
  const recognized = t.words.map((w, i) => i === 2 ? { ...w, start: w.start - 0.5 } : w)
  assert.deepEqual(confirmedPauses(t.words, recognized, marked).map(p => p.after), [4, 8])
})
