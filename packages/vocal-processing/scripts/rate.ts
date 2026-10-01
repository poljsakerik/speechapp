/**
 * Run the pipeline on one recording and print its rate marks: an audio file is
 * transcribed with Deepgram first, a .json is read as a Deepgram response.
 *
 * Importance is message-first unless --importance is given.
 *
 *   pnpm rate ../../recordings/recording-03/recording-03.m4a [--json] [--importance]
 */
import { readFileSync } from "node:fs"
import { transcribe, wordsFromDeepgram } from "../src/deepgram.ts"
import { markImportance, markMessage } from "../src/importance.ts"
import { openaiCompletion } from "../src/openai.ts"
import { DEFAULT_RATE_CONFIG, detectRate } from "../src/rate.ts"

const [path, ...flags] = process.argv.slice(2)
if (!path) throw new Error("Usage: pnpm rate <audio file | deepgram.json> [--json] [--importance]")

const file = readFileSync(path)
const response = path.endsWith(".json") ? JSON.parse(file.toString("utf8")) : await transcribe(file)
const complete = openaiCompletion()
const transcript = wordsFromDeepgram(response)
const labeled = flags.includes("--importance")
  ? { ...(await markImportance(transcript, { complete })), message: undefined }
  : await markMessage(transcript, { complete })
const { message } = labeled
const result = detectRate(labeled.words)

if (flags.includes("--json")) {
  console.log(JSON.stringify({ message, speakerPace: result.speakerPace, variation: result.variation, marks: result.marks }, null, 2))
} else {
  const { referencePace } = DEFAULT_RATE_CONFIG
  if (message) console.log(`Message: ${message.message}`)
  const overall = result.speakerPace ? `x${(result.speakerPace / referencePace).toFixed(2)} of` : "too short to compare with"
  const variation = result.variation === undefined ? "too short to measure" : result.variation.toFixed(2)
  console.log(`Overall pace ${overall} the reference; pace variation ${variation}\n`)
  const labels = { RATE_IMPORTANCE_FAST: "point rushed", RATE_IMPORTANCE_SLOW: "dragging" }
  for (const m of result.marks) {
    const what = `x${m.ratio.toFixed(2)}  ${m.text}`
    console.log(`${m.start.toFixed(1).padStart(6)}s  ${labels[m.rule].padEnd(16)} ${what}`)
  }
}
