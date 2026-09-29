import assert from "node:assert/strict"
import { test } from "node:test"
import { markImportance, splitChunks, type JsonCompletion, type Word } from "./importance.ts"

const words = (text: string): Word[] => text.split(" ").map((t) => ({ text: t }))

test("labels every word and groups phrases", async () => {
  const complete: JsonCompletion = async () => ({
    phrases: [
      { first: 0, last: 0, importance: "filler" },
      { first: 1, last: 3, importance: "unimportant" },
      { first: 4, last: 5, importance: "important" },
    ],
  })
  const result = await markImportance(words("It's it's not very feasible lifetime."), { complete })
  assert.deepEqual(
    result.words.map((w) => w.importance),
    ["filler", "unimportant", "unimportant", "unimportant", "important", "important"],
  )
  assert.deepEqual(result.phrases.map((p) => [p.importance, p.text]), [
    ["filler", "It's"],
    ["unimportant", "it's not very"],
    ["important", "feasible lifetime."],
  ])
})

test("fills gaps, clips out-of-range and overlapping phrases, skips bad labels", async () => {
  const complete: JsonCompletion = async () => ({
    phrases: [
      { first: -2, last: 1, importance: "important" },
      { first: 1, last: 2, importance: "filler" },
      { first: 3, last: 9, importance: "loud" },
    ],
  })
  const result = await markImportance(words("a b c d"), { complete })
  assert.deepEqual(result.words.map((w) => w.importance), ["important", "important", "filler", "unimportant"])
})

test("rejects a reply without phrases", async () => {
  await assert.rejects(markImportance(words("a b"), { complete: async () => ({}) }), /no phrases/)
})

test("splits long transcripts at sentence ends and sends the passage as context", async () => {
  const text = Array.from({ length: 30 }, (_, i) => (i % 5 === 4 ? `w${i}.` : `w${i}`)).join(" ")
  const input = words(text)
  assert.deepEqual(splitChunks(input, 12), [[0, 9], [10, 19], [20, 29]])

  const prompts: string[] = []
  const complete: JsonCompletion = async ({ user }) => {
    prompts.push(user)
    const [, from, to] = user.match(/Words (\d+) to (\d+)/)!.map(Number)
    return { phrases: [{ first: from, last: to, importance: "important" }] }
  }
  const result = await markImportance(input, { complete, chunkWords: 12 })
  assert.equal(prompts.length, 3)
  assert.ok(prompts.every((p) => p.includes(`Context, the whole passage:\n${text}`)))
  assert.ok(result.words.every((w) => w.importance === "important"))
})

test("does not send context for a single chunk", async () => {
  let prompt = ""
  await markImportance(words("a b."), {
    complete: async ({ user }) => {
      prompt = user
      return { phrases: [] }
    },
  })
  assert.equal(prompt, "Words 0 to 1:\n0: a\n1: b.")
})

test("parseLeadingJson ignores text after the object", async () => {
  const { parseLeadingJson } = await import("./openai.ts")
  assert.deepEqual(parseLeadingJson('{"a":"}\\" {","b":[{}]} )))? Wait {x}'), { a: '}" {', b: [{}] })
  assert.throws(() => parseLeadingJson('{"a":'), SyntaxError)
})
