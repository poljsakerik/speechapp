import assert from "node:assert/strict"
import { test } from "node:test"
import { openaiCompletion, parseLeadingJson, rateModelSettings } from "./openai.ts"

test("parseLeadingJson preserves nested objects and escaped strings, ignoring trailing text", () => {
  const value = { a: '}" {', b: [{}] }
  assert.deepEqual(parseLeadingJson(JSON.stringify(value) + " trailing {text}"), value)
  assert.throws(() => parseLeadingJson('{"a":'), SyntaxError)
})

test("live reviews and evaluation resolve the same rate model settings", () => {
  assert.deepEqual(rateModelSettings({}), { model: "gpt-6-sol", effort: "low" })
  assert.deepEqual(rateModelSettings({ RATE_MODEL: "test-model", RATE_EFFORT: "medium" }), { model: "test-model", effort: "medium" })
  assert.throws(() => rateModelSettings({ RATE_EFFORT: "typo" }), /Invalid RATE_EFFORT/)
})

test("an API key is required only when a completion is actually requested", async () => {
  const complete = openaiCompletion({ apiKey: "" })
  await assert.rejects(complete({ system: "", user: "", schema: {}, schemaName: "test" }), /OPENAI_API_KEY is not set/)
})
