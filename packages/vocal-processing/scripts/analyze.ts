/** pnpm analyze <audio | deepgram.json> — the same rate + pause pipeline as a live review. */
import { readFileSync } from "node:fs"
import { analyzeSpeech } from "../src/analysis.ts"
import { transcribe, wordsFromDeepgram } from "../src/deepgram.ts"
import { openaiCompletion } from "../src/openai.ts"

const path = process.argv[2]
if (!path) throw new Error("Usage: pnpm analyze <audio | deepgram.json>")
const file = readFileSync(path)
const response = path.endsWith(".json") ? JSON.parse(file.toString("utf8")) : await transcribe(file)
const { labeled, rate, pauses } = await analyzeSpeech(wordsFromDeepgram(response), openaiCompletion())
console.log(JSON.stringify({ message: labeled.message, rate, pauses }, null, 2))
