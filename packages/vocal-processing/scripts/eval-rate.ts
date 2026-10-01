/** Evaluate the annotated rate development benchmark. Detection is deterministic; no model is called. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { loadAnnotation, loadCorpus, metrics, RATE_RULES, scoreRate, type Counts } from "../src/benchmark.ts"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { wordOffsets } from "../src/golden.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { ALIGN_MODEL, alignWords, loadAligner, resample, type Aligner } from "../src/align.ts"
import { RATE_VERSION, DEFAULT_RATE_CONFIG, detectRate, type RateRule } from "../src/rate.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  "recordings-dir": { type: "string" }, "recognizer-timing": { type: "boolean", default: false },
  report: { type: "string" }, "require-pass": { type: "boolean", default: false },
} })
const root = resolve(values["recordings-dir"] ?? join(import.meta.dirname, "../../../recordings-rate-development"))
const corpus = loadCorpus(root), takes = corpus.takes.filter(t => !positionals.length || positionals.includes(t.id))
if (positionals.some(id => !corpus.takes.some(t => t.id === id))) throw new Error("Unknown take ID")
const totals: Counts = { tp: 0, fp: 0, fn: 0 }
const byRule = Object.fromEntries(RATE_RULES.map(r => [r, { tp: 0, fp: 0, fn: 0 }])) as Record<RateRule, Counts>
const rows: Record<string, unknown>[] = []
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const add = (a: Counts, b: Counts) => { a.tp += b.tp; a.fp += b.fp; a.fn += b.fn }
let aligner: Aligner | undefined
let selected = 0, reviewed = 0, failed = 0, uncertain = 0, cleanTakes = 0, cleanTakesWithFalseAlarms = 0
for (const take of takes) {
  const base = join(root, take.base)
  try {
    const annotation = loadAnnotation(base), review = annotation.reviews.rate
    // An excluded take is deliberately out of scope for rate, e.g. too little speech to judge.
    if (review?.status === "excluded") { rows.push({ id: take.id, status: "excluded", notes: review.notes }); console.log(`${take.id}: excluded`); continue }
    selected++
    if (review?.status !== "reviewed") { rows.push({ id: take.id, status: "unreviewed" }); continue }
    const original = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
    const text = readFileSync(`${base}.txt`, "utf8")
    const bytes = readFileSync(`${base}.${take.audioExtension}`), wav = decodeWav(bytes)
    const pauses = findPauses(wav.samples, wav.sampleRate)
    const audioHash = createHash("sha256").update(bytes).digest("hex")
    let words = original
    if (!values["recognizer-timing"]) {
      const file = join(dirname(base), ".cache", `aligned-${hash({ original, audioHash, model: ALIGN_MODEL.sha256, version: 1 })}.json`)
      if (existsSync(file)) words = JSON.parse(readFileSync(file, "utf8"))
      else {
        aligner ??= await loadAligner()
        words = await alignWords(original, resample(wav.samples, wav.sampleRate), aligner, pauses)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, JSON.stringify(words) + "\n")
      }
    }
    const analysis = detectRate(words, {}, pauses)
    if (!analysis.reliable) uncertain++
    const offsets = wordOffsets(text, original)
    const predicted = (analysis.reliable ? analysis.marks : []).map(m => ({ startAt: m.start, endAt: m.end, startIndex: offsets[m.first]![0], endIndex: offsets[m.last]![1], foundationType: "rate", rule: m.rule }))
    const score = scoreRate(text, original, annotation.marks, predicted)
    reviewed++; add(totals, score)
    for (const rule of RATE_RULES) add(byRule[rule], score.byRule[rule])
    const clean = !annotation.marks.some(m => m.foundationType === "rate")
    if (clean) { cleanTakes++; if (predicted.length) cleanTakesWithFalseAlarms++ }
    const status = analysis.reliable ? "reviewed" : "uncertain"
    writeFileSync(`${base}.rate.pred.json`, JSON.stringify({ model: "pacing", version: RATE_VERSION, config: DEFAULT_RATE_CONFIG,
      ...analysis, status, pauses, marks: predicted.map((m, i) => ({ ...m, hit: score.hits[i] })), score, annotationSignature: JSON.stringify(annotation), corpus: corpus.id }, null, 2) + "\n")
    rows.push({ id: take.id, status, articulationRate: analysis.articulationRate, score, clean, audioHash })
    console.log(`${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn}; ${status}, ${analysis.articulationRate?.toFixed(1)} syllables/s`)
  } catch (error) {
    failed++; rows.push({ id: take.id, status: "error", error: (error as Error).message })
    console.error(`${take.id}: ${(error as Error).message}`)
  }
}
const passed = reviewed === selected && reviewed > 0 && !failed && !uncertain && !totals.fp && !totals.fn
const report = { corpus: corpus.id, version: RATE_VERSION, createdAt: new Date().toISOString(),
  timing: values["recognizer-timing"] ? "recognizer" : "forced alignment", config: DEFAULT_RATE_CONFIG,
  selected, reviewed, failed, uncertain, totals: { ...totals, ...metrics(totals) }, byRule, cleanTakes, cleanTakesWithFalseAlarms, passed, takes: rows }
writeFileSync(values.report ? resolve(values.report) : join(root, "rate-benchmark.json"), JSON.stringify(report, null, 2) + "\n")
console.log(`\nTP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}; ${cleanTakesWithFalseAlarms}/${cleanTakes} clean takes flagged; ${uncertain} uncertain, ${failed} failed, ${takes.length - selected} excluded. Gate: ${passed ? "PASS" : "FAIL"}. Development corpus, not held-out accuracy.`)
if (failed || !reviewed || (values["require-pass"] && !passed)) process.exitCode = 1
