import assert from "node:assert/strict"
import { test } from "node:test"
import { openaiCompletion, parseLeadingJson, rateReviewSettings } from "./openai.ts"

test("parseLeadingJson preserves nested objects and escaped strings, ignoring trailing text", () => {
  const value = { a: '}" {', b: [{}] }
  assert.deepEqual(parseLeadingJson(JSON.stringify(value) + " trailing {text}"), value)
  assert.throws(() => parseLeadingJson('{"a":'), SyntaxError)
})

test("live reviews and benchmark metadata resolve the same rate settings", () => {
  assert.deepEqual(rateReviewSettings({}), { model: "gpt-6-sol", effort: "low" })
  assert.deepEqual(rateReviewSettings({ RATE_MODEL: "test-model", RATE_EFFORT: "medium" }), { model: "test-model", effort: "medium" })
  assert.throws(() => rateReviewSettings({ RATE_EFFORT: "typo" }), /Invalid RATE_EFFORT/)
})

test("an API key is required only when a contextual completion is actually requested", async () => {
  const complete = openaiCompletion({ apiKey: "" })
  await assert.rejects(complete({ system: "", user: "", schema: {}, schemaName: "test" }), /OPENAI_API_KEY is not set/)
})
