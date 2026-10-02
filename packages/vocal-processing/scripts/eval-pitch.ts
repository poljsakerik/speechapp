/**
 * Evaluate the annotated pitch development benchmark: the course coach's
 * natural teaching and deliberate mistakes, and the user's three readings of
 * one paragraph (high, flat, good). The monotone threshold comes from
 * published listener ratings and the register threshold sits in a wide gap,
 * so a pass is a sanity check; held-out recordings are the evidence.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { loadAnnotation, loadCorpus, metrics, PITCH_RULES, scoreMarks, type Counts } from "../src/benchmark.ts"
import { ALIGN_MODEL, alignWords, loadAligner, resample, type Aligner } from "../src/align.ts"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { wordOffsets } from "../src/golden.ts"
import { decodeWav, findPauses } from "../src/pauses.ts"
import { DEFAULT_PITCH_CONFIG, detectPitch, PITCH_VERSION } from "../src/pitch.ts"
import { listenForPitch } from "../src/pitch-listen.ts"
import { cachedJudgment } from "./cache.ts"

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  "recordings-dir": { type: "string" }, "recognizer-timing": { type: "boolean", default: false },
  report: { type: "string" }, "require-pass": { type: "boolean", default: false },
  // Add the audio model's stretches (needs GEMINI_API_KEY; replies are cached per chunk).
  listen: { type: "boolean", default: false },
} })
const root = resolve(values["recordings-dir"] ?? join(import.meta.dirname, "../../../recordings-pitch-development"))
const corpus = loadCorpus(root), takes = corpus.takes.filter(t => !positionals.length || positionals.includes(t.id))
if (positionals.some(id => !corpus.takes.some(t => t.id === id))) throw new Error("Unknown take ID")
const totals: Counts = { tp: 0, fp: 0, fn: 0 }
const rows: Record<string, unknown>[] = []
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
let aligner: Aligner | undefined
let selected = 0, reviewed = 0, failed = 0, uncertain = 0
for (const take of takes) {
  const base = join(root, take.base)
  try {
    const annotation = loadAnnotation(base), review = annotation.reviews.pitch_melody
    if (review?.status === "excluded") { rows.push({ id: take.id, status: "excluded", notes: review.notes }); continue }
    selected++
    if (review?.status !== "reviewed") { rows.push({ id: take.id, status: "unreviewed" }); continue }
    const original = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
    const text = readFileSync(`${base}.txt`, "utf8")
    const bytes = readFileSync(`${base}.${take.audioExtension}`), wav = decodeWav(bytes)
    // Windows count seconds of speaking, so word timing matters; the live review aligns too.
    let words = original
    if (!values["recognizer-timing"]) {
      const file = join(dirname(base), ".cache", `aligned-${hash({ original, audioHash: createHash("sha256").update(bytes).digest("hex"), model: ALIGN_MODEL.sha256, version: 1 })}.json`)
      if (existsSync(file)) words = JSON.parse(readFileSync(file, "utf8"))
      else {
        aligner ??= await loadAligner()
        words = await alignWords(original, resample(wav.samples, wav.sampleRate), aligner, findPauses(wav.samples, wav.sampleRate))
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, JSON.stringify(words) + "\n")
      }
    }
    const heard = values.listen ? await listenForPitch(wav.samples, wav.sampleRate, original, cachedJudgment(join(dirname(base), ".cache"))) : []
    const analysis = detectPitch(wav.samples, wav.sampleRate, words, {}, heard)
    if (!analysis.reliable) uncertain++
    const offsets = wordOffsets(text, original)
    const predicted = analysis.marks.map(m => ({ startAt: m.start, endAt: m.end, startIndex: offsets[m.first]![0], endIndex: offsets[m.last]![1], foundationType: "pitch_melody", rule: m.rule }))
    const score = scoreMarks("pitch_melody", PITCH_RULES, text, original, annotation.marks, predicted)
    reviewed++
    totals.tp += score.tp; totals.fp += score.fp; totals.fn += score.fn
    const status = analysis.reliable ? "reviewed" : "uncertain"
    rows.push({ id: take.id, assignment: take.assignment, status, spread: analysis.spread, score, marks: analysis.marks.map((m, i) => ({ ...m, hit: score.hits[i] })) })
    console.log(`${take.id}: TP ${score.tp}, FP ${score.fp}, FN ${score.fn}; ${status}, ${analysis.spread?.toFixed(2) ?? "-"} semitones${analysis.marks.map(m => `; ${m.rule} ${m.start.toFixed(1)}–${m.end.toFixed(1)}s, spread ${m.spread.toFixed(2)}, shift ${m.shift.toFixed(1)}${m.how ? ` (heard: ${m.how})` : ""}`).join("")}`)
  } catch (error) {
    failed++; rows.push({ id: take.id, status: "error", error: (error as Error).message })
    console.error(`${take.id}: ${(error as Error).message}`)
  }
}
const passed = reviewed === selected && reviewed > 0 && !failed && !uncertain && !totals.fp && !totals.fn
writeFileSync(values.report ? resolve(values.report) : join(root, "pitch-benchmark.json"), JSON.stringify({
  corpus: corpus.id, version: PITCH_VERSION, createdAt: new Date().toISOString(), config: DEFAULT_PITCH_CONFIG,
  timing: values["recognizer-timing"] ? "recognizer" : "forced alignment", listened: values.listen, selected, reviewed, failed, uncertain, totals: { ...totals, ...metrics(totals) }, passed, takes: rows,
}, null, 2) + "\n")
console.log(`\nPitch: TP ${totals.tp}, FP ${totals.fp}, FN ${totals.fn}; ${uncertain} uncertain, ${failed} failed. Gate: ${passed ? "PASS" : "FAIL"}. A sanity check, not held-out accuracy.`)
if (failed || !reviewed || (values["require-pass"] && !passed)) process.exitCode = 1
