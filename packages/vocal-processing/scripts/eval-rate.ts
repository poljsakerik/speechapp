/** Evaluate reviewed voice-pack takes. Unreviewed takes never count as negative examples. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { loadAnnotation, loadCorpus, metrics, RATE_RULES, scoreRate, type Counts } from "../src/benchmark.ts"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { wordOffsets } from "../src/golden.ts"
import { markImportance, markMessage, type MarkedWord, type Message } from "../src/importance.ts"
import { openaiCompletion } from "../src/openai.ts"
import { DEFAULT_RATE_CONFIG, detectRate, type PhraseRef, type RateRule } from "../src/rate.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  strategy: { type: "string", default: "message" }, fresh: { type: "boolean", default: false },
  "recordings-dir": { type: "string" }, "predict-only": { type: "boolean", default: false },
} })
if (!["message", "importance"].includes(values.strategy)) throw new Error("--strategy must be message or importance")
const root = resolve(values["recordings-dir"] ?? join(import.meta.dirname, "../../../recordings"))
const corpus = loadCorpus(root)
if (positionals.some(id => !corpus.takes.some(t => t.id === id))) throw new Error("Unknown take ID; use IDs from recordings/manifest.json")
const takes = corpus.takes.filter(t => !positionals.length || positionals.includes(t.id))
const model = process.env.IMPORTANCE_MODEL ?? "gpt-6-sol", effort = process.env.IMPORTANCE_EFFORT ?? "low"
const totals: Counts = { tp: 0, fp: 0, fn: 0 }
const byRule = Object.fromEntries(RATE_RULES.map(r => [r, { tp: 0, fp: 0, fn: 0 }])) as Record<RateRule, Counts>
const rows: Record<string, unknown>[] = []
let reviewed = 0, cleanTakes = 0, cleanTakesWithFalseAlarms = 0, failed = 0
const add = (a: Counts, b: Counts) => { a.tp += b.tp; a.fp += b.fp; a.fn += b.fn }
for (const take of takes) {
  const base = join(root, take.base)
  try {
    const annotation = loadAnnotation(base)
    const status = annotation.reviews.rate?.status ?? "pending"
    if (status !== "reviewed" && !values["predict-only"]) {
      rows.push({ id: take.id, status }); console.log(`${take.id}: ${status}, not scored`); continue
    }
    const words = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
    const text = readFileSync(`${base}.txt`, "utf8")
    // Cache model labels by transcript, prompt version and settings. The model never sees annotations or take metadata.
    const key = createHash("sha256").update(JSON.stringify({ words, strategy: values.strategy, model, effort, promptVersion: 1 })).digest("hex")
    const cache = join(dirname(base), ".cache", `${key}.json`)
    let labeled: { words: MarkedWord[]; message?: Message }
    if (existsSync(cache) && !values.fresh) labeled = JSON.parse(readFileSync(cache, "utf8"))
    else {
      const complete = openaiCompletion({ model })
      labeled = values.strategy === "message" ? await markMessage(words, { complete }) : await markImportance(words, { complete })
      mkdirSync(dirname(cache), { recursive: true }); writeFileSync(cache, JSON.stringify(labeled) + "\n")
    }
    const result = detectRate(labeled.words), offsets = wordOffsets(text, words)
    const shape = (ref: PhraseRef, rule: RateRule) => {
      const from = offsets[ref.first], to = offsets[ref.last]
      if (!from || !to) throw new Error(`Prediction cannot be aligned: ${take.id}`)
      return { startAt: ref.start, endAt: ref.end, startIndex: from[0], endIndex: to[1], foundationType: "rate", rule, ratio: ref.ratio }
    }
    const predicted = result.marks.map(m => shape(m, m.rule))
    const score = status === "reviewed" && !values["predict-only"] ? scoreRate(text, words, annotation.marks, predicted) : null
    const marks = result.marks.map((m, i) => ({ ...predicted[i], impact: m.impact, hit: score?.hits[i] ?? null }))
    writeFileSync(`${base}.rate.pred.json`, JSON.stringify({ model: `${values.strategy} · ${model}:${effort}`, config: DEFAULT_RATE_CONFIG, speakerPace: result.speakerPace, variation: result.variation, message: labeled.message, marks, score, annotationSignature: score ? JSON.stringify(annotation) : null, corpus: corpus.id }, null, 2) + "\n")
    if (score) {
      reviewed++; add(totals, score)
      for (const rule of RATE_RULES) add(byRule[rule], score.byRule[rule])
      const isClean = !annotation.marks.some(m => m.foundationType === "rate")
      if (isClean) { cleanTakes++; if (predicted.length) cleanTakesWithFalseAlarms++ }
      rows.push({ id: take.id, foundation: take.foundation, status, score })
      console.log(`${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn}${isClean ? " (reviewed clear)" : ""}`)
    } else { rows.push({ id: take.id, status, predictions: predicted.length }); console.log(`${take.id}: ${predicted.length} predictions, not scored`) }
  } catch (error) {
    failed++; rows.push({ id: take.id, status: "error", error: (error as Error).message }); console.error(`${take.id}: ${(error as Error).message}`)
  }
}
const report = { corpus: corpus.id, createdAt: new Date().toISOString(), mode: values["predict-only"] ? "predict-only" : "benchmark", selected: takes.length, reviewed, failed, detectorLimits: { minMonotoneSeconds: DEFAULT_RATE_CONFIG.minMonotoneSeconds, shorterTakes: takes.filter(t => t.duration < DEFAULT_RATE_CONFIG.minMonotoneSeconds).length }, matching: "same rule, word IoU >= 0.3, maximum one-to-one matching; direct speed-up/slow-down phrase marks", totals: { ...totals, ...metrics(totals) }, byRule, cleanTakes, cleanTakesWithFalseAlarms, takes: rows }
writeFileSync(join(root, values["predict-only"] ? "rate-predictions.json" : "rate-benchmark.json"), JSON.stringify(report, null, 2) + "\n")
console.log(`\n${reviewed}/${takes.length} reviewed takes scored. TP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}.`)
if (!reviewed && !values["predict-only"]) console.log("No benchmark score yet. Annotate takes and mark Rate of speech as reviewed in pnpm markup-tools. Empty reviewed takes count as clear examples.")
console.log("This is a single-speaker, repeated-paragraph development benchmark, not a held-out accuracy estimate.")
if (failed || (!reviewed && !values["predict-only"])) process.exitCode = 1
