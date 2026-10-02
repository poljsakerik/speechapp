/**
 * How well a group of speakers' pace follows the text-based pacing prediction,
 * and how often the contrast check flags their passages. Skilled speakers
 * should agree more and be flagged less than untrained ones, but not
 * perfectly: speech allows several valid paces.
 *
 *   node scripts/eval-pacing.ts recordings.json [--report out.json]
 *
 * recordings.json lists { name, group, audio, transcript }: a PCM WAV and its
 * Deepgram JSON response. Paths are relative to the list file.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { ALIGN_MODEL, alignWords, loadAligner, resample, type Aligner } from "../src/align.ts"
import { predictPacing } from "../src/pacing.ts"
import { RATE_VERSION, detectRate } from "../src/rate.ts"
import { cachedCompletion } from "./cache.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: { report: { type: "string" } } })
if (!positionals[0]) throw new Error("Usage: node scripts/eval-pacing.ts recordings.json [--report out.json]")
const list = resolve(positionals[0]), root = dirname(list), cache = join(root, ".cache")
const recordings = JSON.parse(readFileSync(list, "utf8")) as { name: string; group: string; audio: string; transcript: string }[]
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const rank = (v: number[]) => {
  const order = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array<number>(v.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2
    i = j + 1
  }
  return r
}
const correlation = (a: number[], b: number[]) => {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n
  const d = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0))
  return d ? a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / d : 0
}
let aligner: Aligner | undefined
const rows: { name: string; group: string; minutes: number; phrases: number; agreement: number; passages: number; flagged: number }[] = []
for (const r of recordings) {
  const bytes = readFileSync(resolve(root, r.audio)), wav = decodeWav(bytes)
  const original = wordsFromDeepgram(JSON.parse(readFileSync(resolve(root, r.transcript), "utf8")))
  const pauses = findPauses(wav.samples, wav.sampleRate)
  const file = join(cache, `aligned-${hash({ original, audio: hash(bytes.toString("base64")), model: ALIGN_MODEL.sha256, version: 1 })}.json`)
  const words = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as typeof original : await (async () => {
    aligner ??= await loadAligner()
    const aligned = await alignWords(original, resample(wav.samples, wav.sampleRate), aligner, pauses)
    mkdirSync(cache, { recursive: true })
    writeFileSync(file, JSON.stringify(aligned) + "\n")
    return aligned
  })()
  const analysis = detectRate(words, {}, pauses, await predictPacing(original, cachedCompletion(cache)))
  if (!analysis.reliable || analysis.phrases.length < 5) { console.log(`${r.name}: too little speech`); continue }
  // Faster pace (positive) should go with "move through" (positive) scores.
  const agreement = correlation(rank(analysis.phrases.map(p => p.score)), rank(analysis.phrases.map(p => p.pace)))
  const flagged = analysis.passages.filter(p => p.flagged).length
  rows.push({ name: r.name, group: r.group, minutes: (words.at(-1)!.end! - words[0].start!) / 60, phrases: analysis.phrases.length, agreement, passages: analysis.passages.length, flagged })
  console.log(`${r.name} (${r.group}): agreement ${agreement.toFixed(2)}, ${flagged}/${analysis.passages.length} passages flagged`)
}
const groups = [...new Set(rows.map(r => r.group))].map(group => {
  const rs = rows.filter(r => r.group === group), phrases = rs.reduce((s, r) => s + r.phrases, 0)
  const passages = rs.reduce((s, r) => s + r.passages, 0), flagged = rs.reduce((s, r) => s + r.flagged, 0)
  return { group, recordings: rs.length, minutes: rs.reduce((s, r) => s + r.minutes, 0), phrases, agreement: rs.reduce((s, r) => s + r.agreement * r.phrases, 0) / phrases, passages, flagged }
})
console.log("\ngroup                recordings  minutes  phrases  agreement  passages flagged")
for (const g of groups) console.log(`${g.group.padEnd(20)} ${String(g.recordings).padStart(10)} ${g.minutes.toFixed(1).padStart(8)} ${String(g.phrases).padStart(8)} ${g.agreement.toFixed(2).padStart(10)}  ${g.flagged}/${g.passages} (${g.passages ? Math.round(100 * g.flagged / g.passages) : 0}%)`)
if (values.report) writeFileSync(resolve(values.report), JSON.stringify({ version: RATE_VERSION, createdAt: new Date().toISOString(), groups, recordings: rows }, null, 2) + "\n")
