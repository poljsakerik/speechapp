/**
 * Mark a Deepgram transcript and print it: IMPORTANT words in capitals,
 * [filler] in brackets, the rest as spoken.
 *
 *   npm run importance -- ../recordings/recording-03-rate/recording-03-rate.json [--json]
 */
import { readFileSync } from "node:fs"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { markImportance } from "../src/importance.ts"
import { openaiCompletion } from "../src/openai.ts"

const [path, flag] = process.argv.slice(2)
if (!path) throw new Error("Usage: npm run importance -- <deepgram.json> [--json]")

const words = wordsFromDeepgram(JSON.parse(readFileSync(path, "utf8")))
const result = await markImportance(words, { complete: openaiCompletion() })

if (flag === "--json") {
  console.log(JSON.stringify(result, null, 2))
} else {
  const show = { message: (t: string) => `**${t.toUpperCase()}**`, important: (t: string) => t.toUpperCase(), unimportant: (t: string) => t, filler: (t: string) => `[${t}]` }
  console.log(result.phrases.map((p) => show[p.importance](p.text)).join(" "))
}
