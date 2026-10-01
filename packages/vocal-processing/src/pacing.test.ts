import assert from "node:assert/strict"
import { test } from "node:test"
import { PACING_PROMPT, pacingPhrases, parsePacing, predictPacing } from "./pacing.ts"

const words = (text: string) => text.split(" ").map(t => ({ text: t }))

test("phrases come from the text: punctuation first, then near-equal pieces of at most eight words", () => {
  assert.deepEqual(pacingPhrases(words("So here it is. Sales fell, and fast.")), [[0, 3], [4, 5], [6, 7]])
  const run = Array.from({ length: 20 }, () => "word").join(" ")
  assert.deepEqual(pacingPhrases(words(run)), [[0, 5], [6, 12], [13, 19]])
  assert.deepEqual(pacingPhrases(words("By... and then")), [[0, 0], [1, 2]], "an ellipsis ends a phrase")
})

test("the model scores every phrase exactly once with an allowed value", () => {
  assert.deepEqual(parsePacing({ scores: [{ id: 1, score: 2 }, { id: 0, score: -2 }] }, 2), [-2, 2])
  assert.throws(() => parsePacing({ scores: [{ id: 0, score: 1 }] }, 2), /every phrase/)
  assert.throws(() => parsePacing({ scores: [{ id: 0, score: 1 }, { id: 0, score: 1 }] }, 2), /Invalid/)
  assert.throws(() => parsePacing({ scores: [{ id: 0, score: 1 }, { id: 2, score: 1 }] }, 2), /Invalid/)
  assert.throws(() => parsePacing({ scores: [{ id: 0, score: 3 }, { id: 1, score: 1 }] }, 2), /Invalid/)
})

test("the prediction reads only the numbered phrases of the transcript", async () => {
  let seen: { system: string; user: string } | undefined
  const prediction = await predictPacing(words("So here it is. Sales fell by half."), async request => {
    seen = request
    return { scores: [{ id: 0, score: 2 }, { id: 1, score: -2 }] }
  })
  assert.equal(seen!.system, PACING_PROMPT)
  assert.equal(seen!.user, "0: So here it is.\n1: Sales fell by half.")
  assert.deepEqual(prediction, { phrases: [[0, 3], [4, 7]], scores: [2, -2] })
})

test("a long talk is scored in chunks, each with the neighbouring text as context", async () => {
  const text = Array.from({ length: 300 }, (_, i) => `phrase${i}.`).join(" ")
  const requests: string[] = []
  const prediction = await predictPacing(words(text), async ({ user }) => {
    requests.push(user)
    const count = user.split("\n").filter(line => /^\d+: /.test(line)).length
    return { scores: Array.from({ length: count }, (_, id) => ({ id, score: requests.length % 2 ? 1 : -1 })) }
  }, undefined, 1)
  assert.equal(requests.length, 3)
  assert.equal(prediction.scores.length, 300)
  assert.match(requests[1], /^Context before \(do not score\):\nphrase90\. /)
  assert.match(requests[1], /^0: phrase120\.$/m)
  assert.match(requests[1], /Context after \(do not score\):\nphrase240\. /)
  assert.ok(!requests[0].includes("Context before"))
})
