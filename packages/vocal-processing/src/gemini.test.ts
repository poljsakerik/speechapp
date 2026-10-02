import assert from "node:assert/strict"
import { test } from "node:test"
import { geminiSettings, geminiVoice, parseRating, wav } from "./gemini.ts"

test("the audio goes out as mono 16-bit WAV at its own sample rate", () => {
  const file = wav(new Float32Array([0, 1, -2]), 22050)
  assert.equal(file.length, 44 + 6)
  assert.equal(file.readUInt32LE(24), 22050)
  assert.deepEqual([file.readInt16LE(44), file.readInt16LE(46), file.readInt16LE(48)], [0, 32767, -32767])
})

test("a reply must hold a whole rating from 1 to 5, and thoughts are skipped", () => {
  const reply = (...texts: [string, boolean?][]) => ({ candidates: [{ content: { parts: texts.map(([text, thought]) => ({ text, thought })) } }] })
  assert.equal(parseRating(reply(['{"expressiveness": 9}', true], ['{"expressiveness": 2}'])), 2)
  assert.throws(() => parseRating(reply(['{"expressiveness": 6}'])), /invalid rating/)
  assert.throws(() => parseRating(reply(['{"expressiveness": 2.5}'])), /invalid rating/)
  assert.throws(() => parseRating({}), SyntaxError)
})

test("Gemini 3.5 Flash by default, and the key is only needed when a voice is rated", async () => {
  assert.deepEqual(geminiSettings({}), { model: "gemini-3.5-flash" })
  assert.deepEqual(geminiSettings({ GEMINI_MODEL: "gemini-3.1-pro-preview" }), { model: "gemini-3.1-pro-preview" })
  await assert.rejects(geminiVoice({ apiKey: "" })(new Float32Array(16000), 16000), /GEMINI_API_KEY is not set/)
})
