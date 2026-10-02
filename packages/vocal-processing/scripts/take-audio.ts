/** Words, measured pauses and aligned timing for a benchmark take; alignments are cached next to the take. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { ALIGN_MODEL, alignWords, loadAligner, resample, type Aligner } from "../src/align.ts"
import type { Take } from "../src/benchmark.ts"
import type { JsonCompletion } from "../src/types.ts"

let aligner: Aligner | undefined
export async function loadTake(root: string, take: Take, align = true) {
  const base = join(root, take.base)
  const original = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
  const text = readFileSync(`${base}.txt`, "utf8")
  const bytes = readFileSync(`${base}.${take.audioExtension}`), wav = decodeWav(bytes)
  const pauses = findPauses(wav.samples, wav.sampleRate)
  const audioHash = createHash("sha256").update(bytes).digest("hex")
  let words = original
  if (align) {
    // Same cache key as eval-rate, so the benchmarks share alignments.
    const file = join(dirname(base), ".cache", `aligned-${createHash("sha256").update(JSON.stringify({ original, audioHash, model: ALIGN_MODEL.sha256, version: 1 })).digest("hex")}.json`)
    if (existsSync(file)) words = JSON.parse(readFileSync(file, "utf8"))
    else {
      aligner ??= await loadAligner()
      words = await alignWords(original, resample(wav.samples, wav.sampleRate), aligner, pauses)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(words) + "\n")
    }
  }
  return { base, original, words, text, pauses, audioHash }
}

/** Model replies cached by request, model settings and run label, so benchmark reruns are reproducible. */
export function cachedCompletion(dir: string, complete: JsonCompletion, settings: unknown): JsonCompletion {
  return async request => {
    const file = join(dir, `reply-${createHash("sha256").update(JSON.stringify({ request, settings })).digest("hex")}.json`)
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
    const reply = await complete(request)
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(reply) + "\n")
    return reply
  }
}
