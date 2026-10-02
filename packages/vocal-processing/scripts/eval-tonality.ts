/**
 * Evaluate the annotated tonality development benchmark. Excluded takes are
 * still analyzed and listed, but not scored.
 *
 * This is a smoke test, not an accuracy gate: it has one scored positive.
 * Delivery has many valid readings, so a perfect score here is expected for
 * an obvious example and is not evidence of accuracy. Gemini ratings and
 * text-model replies are cached per run label; use --label-run to draw a
 * fresh, independent set. TONALITY_FLAT_SCORE changes the flagged score.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { loadAnnotation, loadCorpus, metrics, scoreMarks, TONE_RULES, type Counts } from "../src/benchmark.ts"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { geminiSettings, geminiVoice, VOICE_PROMPT, wav as wavFile } from "../src/gemini.ts"
import { wordOffsets } from "../src/golden.ts"
import { openaiCompletion, tonalitySettings } from "../src/openai.ts"
import { decodeWav } from "../src/pauses.ts"
import { reviewTonality, tonalityConfig, TONALITY_VERSION } from "../src/tonality.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  "recordings-dir": { type: "string" }, report: { type: "string" }, "label-run": { type: "string", default: "default" },
} })
const root = resolve(values["recordings-dir"] ?? join(import.meta.dirname, "../../../recordings-tonality-development"))
const corpus = loadCorpus(root), takes = corpus.takes.filter(t => !positionals.length || positionals.includes(t.id))
if (positionals.some(id => !corpus.takes.some(t => t.id === id))) throw new Error("Unknown take ID")
const settings = tonalitySettings(), llm = openaiCompletion(settings), voice = geminiVoice(), gemini = geminiSettings(), config = tonalityConfig()
const hash = (value: unknown) => createHash("sha256").update(Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex")
/** A reply read from `file` if present, otherwise fetched and saved there. */
async function cached<T>(file: string, fetch: () => Promise<T>): Promise<T> {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T
  const reply = await fetch()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(reply) + "\n")
  return reply
}
const totals: Counts = { tp: 0, fp: 0, fn: 0 }
const rows: Record<string, unknown>[] = []
let selected = 0, reviewed = 0, failed = 0, cleanTakes = 0, cleanTakesWithFalseAlarms = 0
for (const take of takes) {
  const base = join(root, take.base)
  try {
    const annotation = loadAnnotation(base), review = annotation.reviews.tonality
    const words = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
    const wav = decodeWav(readFileSync(`${base}.${take.audioExtension}`))
    const cache = join(dirname(base), ".cache"), run = values["label-run"]
    const analysis = await reviewTonality(words, wav.samples, wav.sampleRate,
      (samples, sampleRate) => cached(join(cache, `voice-${hash({ audio: hash(wavFile(samples, sampleRate)), prompt: VOICE_PROMPT, ...gemini, run })}.json`), () => voice(samples, sampleRate)),
      request => cached(join(cache, `tonality-${hash({ request, ...settings, version: TONALITY_VERSION, run })}.json`), () => llm(request)), config)
    const summary = analysis.passages.map(p => `voice ${p.expressiveness}/5, words fit ${p.fits.join("/")}`).join("; ")
    // An excluded take is out of scope for scoring; its analysis is still shown.
    if (review?.status === "excluded") {
      rows.push({ id: take.id, status: "excluded", flagged: analysis.marks.length, passages: analysis.passages, notes: review.notes })
      console.log(`${take.id}: excluded (${summary})`)
      continue
    }
    selected++
    if (review?.status !== "reviewed") { rows.push({ id: take.id, status: "unreviewed" }); continue }
    const text = readFileSync(`${base}.txt`, "utf8"), offsets = wordOffsets(text, words)
    const predicted = analysis.marks.map(m => ({ startAt: m.start, endAt: m.end, startIndex: offsets[m.first]![0], endIndex: offsets[m.last]![1], foundationType: "tonality", rule: m.rule }))
    const score = scoreMarks("tonality", TONE_RULES, text, words, annotation.marks, predicted)
    reviewed++; totals.tp += score.tp; totals.fp += score.fp; totals.fn += score.fn
    const clean = !annotation.marks.some(m => m.foundationType === "tonality")
    if (clean) { cleanTakes++; if (predicted.length) cleanTakesWithFalseAlarms++ }
    writeFileSync(`${base}.tonality.pred.json`, JSON.stringify({ model: `${gemini.model} + ${settings.model}:${settings.effort}`, version: TONALITY_VERSION, config,
      ...analysis, marks: predicted.map((m, i) => ({ ...m, hit: score.hits[i] })), score, annotationSignature: JSON.stringify(annotation), corpus: corpus.id }, null, 2) + "\n")
    rows.push({ id: take.id, status: "reviewed", passages: analysis.passages, score, clean })
    console.log(`${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn} (${summary})`)
  } catch (error) {
    failed++; rows.push({ id: take.id, status: "error", error: (error as Error).message })
    console.error(`${take.id}: ${(error as Error).message}`)
  }
}
const report = { corpus: corpus.id, version: TONALITY_VERSION, createdAt: new Date().toISOString(), voiceModel: gemini.model, ...settings, run: values["label-run"],
  config, selected, reviewed, failed, totals: { ...totals, ...metrics(totals) }, cleanTakes, cleanTakesWithFalseAlarms, takes: rows }
writeFileSync(values.report ? resolve(values.report) : join(root, "tonality-benchmark.json"), JSON.stringify(report, null, 2) + "\n")
console.log(`\nTP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}; ${cleanTakesWithFalseAlarms}/${cleanTakes} clean takes flagged; ${failed} failed, ${takes.length - selected} excluded. A smoke test on a development corpus, not accuracy.`)
if (failed || !reviewed) process.exitCode = 1
