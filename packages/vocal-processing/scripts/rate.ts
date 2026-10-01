/** Analyze a WAV file (with audio evidence) or a saved Deepgram JSON response. */
import { readFileSync } from "node:fs"
import { transcribe, wordsFromDeepgram } from "../src/deepgram.ts"
import { openaiCompletion } from "../src/openai.ts"
import { predictPacing } from "../src/pacing.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { alignWords, loadAligner, resample } from "../src/align.ts"
import { detectRate } from "../src/rate.ts"

const [path, ...flags] = process.argv.slice(2)
if (!path) throw new Error("Usage: pnpm rate <recording.wav | deepgram.json> [--json]")
if (!path.endsWith(".wav") && !path.endsWith(".json")) throw new Error("Use a WAV file to measure pace and pauses, or a saved Deepgram JSON for inspection")
const file = readFileSync(path)
const response = path.endsWith(".json") ? JSON.parse(file.toString("utf8")) : await transcribe(file)
let words = wordsFromDeepgram(response)
const pacing = await predictPacing(words, openaiCompletion())
const wav = path.endsWith(".wav") ? decodeWav(file) : undefined
const pauses = wav && findPauses(wav.samples, wav.sampleRate)
if (wav) words = await alignWords(words, resample(wav.samples, wav.sampleRate), await loadAligner(), pauses ?? [])
const analysis = detectRate(words, {}, pauses, pacing)
// Timing without the waveform is inspection data, not a completed audio review.
const status = wav && analysis.reliable ? "reviewed" : "uncertain"
if (flags.includes("--json")) console.log(JSON.stringify({ ...analysis, status }, null, 2))
else {
  const flagged = analysis.passages.filter(p => p.flagged).length
  console.log(`${status}; ${analysis.articulationRate?.toFixed(1) ?? "unavailable"} syllables/s while speaking; ${flagged} of ${analysis.passages.length} passages with key points no slower than the setup`)
  for (const mark of status === "reviewed" ? analysis.marks : []) {
    console.log(`${mark.start.toFixed(1)}–${mark.end.toFixed(1)}s ${mark.reason === "contrast" ? "key points not slower than the setup" : `${mark.rule} (${mark.articulationRate.toFixed(1)} syllables/s)`}`)
    for (const s of mark.suggestions ?? []) console.log(`    ${s.direction === "slow_down" ? "slow down on" : "move through"}: ${s.text}`)
  }
}
