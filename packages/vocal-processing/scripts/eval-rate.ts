/** Evaluate the annotated rate development benchmark. Corpus labels never enter model requests. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { loadAnnotation, loadCorpus, metrics, RATE_RULES, scoreRate, type Counts } from "../src/benchmark.ts"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { wordOffsets } from "../src/golden.ts"
import { openaiCompletion } from "../src/openai.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { ALIGN_MODEL, alignWords, loadAligner, resample, type Aligner } from "../src/align.ts"
import { measureProsody } from "../src/prosody.ts"
import { RATE_VERSION, DEFAULT_RATE_CONFIG, contextCandidates, detectRate, rateReviewRequest, applyRateReview, type RateRule } from "../src/rate.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  fresh: { type: "boolean", default: false }, "recordings-dir": { type: "string" },
  "recognizer-timing": { type: "boolean", default: false }, "label-run": { type: "string", default: "default" },
  report: { type: "string" }, "require-pass": { type: "boolean", default: false },
} })
const root = resolve(values["recordings-dir"] ?? join(import.meta.dirname, "../../../recordings-rate-development"))
const corpus = loadCorpus(root), takes = corpus.takes.filter(t => !positionals.length || positionals.includes(t.id))
if (positionals.some(id => !corpus.takes.some(t => t.id === id))) throw new Error("Unknown take ID")
const model = process.env.RATE_MODEL ?? process.env.IMPORTANCE_MODEL ?? "gpt-6-sol"
const effort = process.env.IMPORTANCE_EFFORT ?? "low"
const totals: Counts = { tp: 0, fp: 0, fn: 0 }
const byRule = Object.fromEntries(RATE_RULES.map(r => [r, { tp: 0, fp: 0, fn: 0 }])) as Record<RateRule, Counts>
const rows: Record<string, unknown>[] = []
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const add = (a: Counts, b: Counts) => { a.tp += b.tp; a.fp += b.fp; a.fn += b.fn }
let aligner: Aligner | undefined
let reviewed = 0, failed = 0, uncertain = 0, cleanTakes = 0, cleanTakesWithFalseAlarms = 0
for (const take of takes) {
  const base = join(root, take.base)
  try {
    const annotation = loadAnnotation(base)
    if (annotation.reviews.rate?.status !== "reviewed") { rows.push({ id: take.id, status: "unreviewed" }); continue }
    const original = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
    const text = readFileSync(`${base}.txt`, "utf8")
    const bytes = readFileSync(`${base}.${take.audioExtension}`), wav = decodeWav(bytes)
    const pauses = findPauses(wav.samples, wav.sampleRate)
    const audioHash = createHash("sha256").update(bytes).digest("hex")
    const cacheDir = join(dirname(base), ".cache")
    mkdirSync(cacheDir, { recursive: true })
    let words = original
    if (!values["recognizer-timing"]) {
      const file = join(cacheDir, `aligned-${hash({ original, audioHash, model: ALIGN_MODEL.sha256, version: 1 })}.json`)
      if (existsSync(file)) words = JSON.parse(readFileSync(file, "utf8"))
      else {
        aligner ??= await loadAligner()
        words = await alignWords(original, resample(wav.samples, wav.sampleRate), aligner, pauses)
        writeFileSync(file, JSON.stringify(words) + "\n")
      }
    }
    const analysis = detectRate(words, {}, pauses, measureProsody(wav.samples, wav.sampleRate))
    const context = existsSync(`${base}.context.txt`) ? readFileSync(`${base}.context.txt`, "utf8") : undefined
    const request = rateReviewRequest(words, analysis, context)
    const key = hash({ request, audioHash, model, effort, version: RATE_VERSION, run: values["label-run"] })
    const file = join(cacheDir, `rate-${key}.json`)
    let reply: unknown = { decisions: [] }
    if (analysis.reliable && contextCandidates(analysis).length) {
      if (existsSync(file) && !values.fresh) reply = JSON.parse(readFileSync(file, "utf8"))
      else {
        reply = await openaiCompletion({ model })(request)
        // Validate before caching; a malformed reply must not poison later runs.
        applyRateReview(words, analysis, reply)
        writeFileSync(file, JSON.stringify(reply) + "\n")
      }
    }
    const result = analysis.reliable ? applyRateReview(words, analysis, reply) : { ...analysis, marks: [], decisions: [], status: "uncertain" }
    if (result.status === "uncertain") uncertain++
    const offsets = wordOffsets(text, original)
    const predicted = result.marks.map(m => ({ startAt: m.start, endAt: m.end, startIndex: offsets[m.first]![0], endIndex: offsets[m.last]![1], foundationType: "rate", rule: m.rule, ratio: m.ratio }))
    const score = scoreRate(text, original, annotation.marks, predicted)
    reviewed++; add(totals, score)
    for (const rule of RATE_RULES) add(byRule[rule], score.byRule[rule])
    const clean = !annotation.marks.some(m => m.foundationType === "rate")
    if (clean) { cleanTakes++; if (predicted.length) cleanTakesWithFalseAlarms++ }
    writeFileSync(`${base}.rate.pred.json`, JSON.stringify({ model: `pacing · ${model}:${effort}`, version: RATE_VERSION, config: DEFAULT_RATE_CONFIG,
      ...analysis, decisions: result.decisions, status: result.status, pauses,
      marks: predicted.map((m, i) => ({ ...m, hit: score.hits[i] })), score, annotationSignature: JSON.stringify(annotation), corpus: corpus.id }, null, 2) + "\n")
    rows.push({ id: take.id, status: result.status, candidates: analysis.candidates.length, score, clean, audioHash, reviewKey: key })
    console.log(`${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn}; ${result.status}`)
  } catch (error) {
    failed++; rows.push({ id: take.id, status: "error", error: (error as Error).message })
    console.error(`${take.id}: ${(error as Error).message}`)
  }
}
const passed = reviewed === takes.length && reviewed > 0 && !failed && !uncertain && !totals.fp && !totals.fn
const report = { corpus: corpus.id, version: RATE_VERSION, createdAt: new Date().toISOString(), model, effort, run: values["label-run"],
  timing: values["recognizer-timing"] ? "recognizer" : "forced alignment", config: DEFAULT_RATE_CONFIG,
  selected: takes.length, reviewed, failed, uncertain, totals: { ...totals, ...metrics(totals) }, byRule, cleanTakes, cleanTakesWithFalseAlarms, passed, takes: rows }
writeFileSync(values.report ? resolve(values.report) : join(root, "rate-benchmark.json"), JSON.stringify(report, null, 2) + "\n")
console.log(`\nTP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}; ${cleanTakesWithFalseAlarms}/${cleanTakes} clean takes flagged; ${uncertain} uncertain, ${failed} failed. Gate: ${passed ? "PASS" : "FAIL"}. Development corpus, not held-out accuracy.`)
if (failed || !reviewed || (values["require-pass"] && !passed)) process.exitCode = 1
