/** Analyze a WAV file (with audio evidence) or a saved Deepgram JSON response. */
import { readFileSync } from "node:fs"
import { transcribe, wordsFromDeepgram } from "../src/deepgram.ts"
import { openaiCompletion } from "../src/openai.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { alignWords, loadAligner, resample } from "../src/align.ts"
import { detectRate } from "../src/rate.ts"
import { reviewRate } from "../src/rate-review.ts"

const [path, ...flags] = process.argv.slice(2)
if (!path) throw new Error("Usage: pnpm rate <recording.wav | deepgram.json> [--json]")
if (!path.endsWith(".wav") && !path.endsWith(".json")) throw new Error("Use a WAV file to measure pace and pauses, or a saved Deepgram JSON for inspection")
const file = readFileSync(path)
const response = path.endsWith(".json") ? JSON.parse(file.toString("utf8")) : await transcribe(file)
let words = wordsFromDeepgram(response)
const wav = path.endsWith(".wav") ? decodeWav(file) : undefined
const pauses = wav && findPauses(wav.samples, wav.sampleRate)
if (wav) words = await alignWords(words, resample(wav.samples, wav.sampleRate), await loadAligner(), pauses ?? [])
const analysis = detectRate(words, {}, pauses)
// Timing without the waveform is inspection data, not a completed audio review.
if (!wav) analysis.reliable = false
const result = await reviewRate(words, analysis, openaiCompletion())
if (flags.includes("--json")) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`${result.status}; ${Math.round(result.wordsPerMinute ?? 0)} words/min`)
  for (const mark of result.marks) console.log(`${mark.start.toFixed(1)}–${mark.end.toFixed(1)}s ${mark.rule}: ${mark.text}`)
}
