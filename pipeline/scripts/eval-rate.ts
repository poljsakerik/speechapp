/**
 * Run the rate stage with its default config on a golden recording and see how
 * its few marks line up with the golden ones. Nothing is tuned here.
 *
 * The golden rate marks are over-specific (they compare the take with one
 * retake), so the scores ask two coach-level questions:
 * - precision: does each change we ask for touch a golden mark of its rule? A
 *   RATE_MONOTONE mark asks through its slow-down and speed-up suggestions,
 *   which are checked against golden FAST and SLOW marks.
 * - clear recall: of the golden marks that are clear outliers against the
 *   retake (x0.7 or less, x1.6 or more in <id>.golden.notes.json), how many do
 *   we touch? Without notes every golden mark counts.
 *
 * If the recording has a good re-record at retake/Retake-clipped.json, the
 * stage runs on it too: a good delivery should get almost no marks.
 *
 * Importance labels come from the model once and are cached in the recording's
 * .cache folder (--fresh to redo them). The marks are written to
 * <id>.rate.pred.json for the golden-set annotator.
 *
 *   npm run eval:rate -- [recording-03] [--strategy message|importance] [--split 160] [--fresh]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { alignMarks, wordOffsets, type GoldenMark } from "../src/golden.ts"
import { markImportance, markMessage, type MarkedWord, type Message, type Word } from "../src/importance.ts"
import { openaiCompletion } from "../src/openai.ts"
import { DEFAULT_RATE_CONFIG, detectRate, type PhraseRef, type RateRule } from "../src/rate.ts"

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    split: { type: "string", default: "160" },
    strategy: { type: "string", default: "message" },
    fresh: { type: "boolean", default: false },
  },
})
const id = positionals[0] ?? "recording-03"
const split = Number(values.split)
const strategy = values.strategy === "importance" ? "importance" : "message"
const dir = join(import.meta.dirname, "../../recordings", id)
const model = process.env.IMPORTANCE_MODEL ?? "gpt-6-sol"
const effort = process.env.IMPORTANCE_EFFORT ?? "low"

const words = wordsFromDeepgram(JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")))
const text = readFileSync(join(dir, `${id}.txt`), "utf8")
const golden = (JSON.parse(readFileSync(join(dir, `${id}.golden.json`), "utf8")) as GoldenMark[]).filter(
  (m) => m.rule === "RATE_IMPORTANCE_FAST" || m.rule === "RATE_IMPORTANCE_SLOW",
)
const notesPath = join(dir, `${id}.golden.notes.json`)
const notes = existsSync(notesPath) ? (JSON.parse(readFileSync(notesPath, "utf8")) as (GoldenMark & { _why: string })[]) : []
const isClear = (m: GoldenMark) => {
  if (!notes.length) return true
  const note = notes.find((n) => n.rule === m.rule && n.startIndex === m.startIndex)
  const ratio = Number(note?._why.match(/x([\d.]+)/)?.[1])
  return ratio > 0 && (ratio <= 0.7 || ratio >= 1.6)
}
const goldSpans = alignMarks(text, words, golden)
  .map((covered, k) => ({ rule: golden[k].rule as RateRule, words: covered, clear: isClear(golden[k]) }))
  .filter((s) => s.words.length)

const { words: marked, message } = await labels(words, "")

async function labels(transcript: Word[], prefix: string): Promise<{ words: MarkedWord[]; message?: Message }> {
  const path = join(dir, ".cache", `${prefix}${strategy}-${model}-${effort}.json`)
  if (existsSync(path) && !values.fresh) return JSON.parse(readFileSync(path, "utf8"))
  const complete = openaiCompletion({ model })
  const labeled =
    strategy === "message"
      ? await markMessage(transcript, { complete })
      : { ...(await markImportance(transcript, { complete })), message: undefined }
  const cached = { words: labeled.words, message: labeled.message }
  mkdirSync(join(dir, ".cache"), { recursive: true })
  writeFileSync(path, JSON.stringify(cached))
  return cached
}

const result = detectRate(marked)
const part = (index: number) => ((words[index].start ?? 0) < split ? "train" : "test")
const touches = (p: PhraseRef, rule: RateRule) => goldSpans.some((g) => g.rule === rule && g.words.some((i) => i >= p.first && i <= p.last))

// Every place the stage asks for a change, with the golden rule it corresponds to.
const asks = result.marks.flatMap((m) =>
  m.rule === "RATE_MONOTONE"
    ? [
        ...(m.slowDown ? [{ ref: m.slowDown, rule: "RATE_IMPORTANCE_FAST" as RateRule }] : []),
        ...(m.speedUp ? [{ ref: m.speedUp, rule: "RATE_IMPORTANCE_SLOW" as RateRule }] : []),
      ]
    : [{ ref: m as PhraseRef, rule: m.rule }],
)

const pct = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : "-")
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`
const share = (label: string) => marked.filter((w) => w.importance === label).length

console.log(`${id}, ${strategy} labels from ${model}:${effort}: ${share("message")} message, ${share("important")} important of ${marked.length} words`)
if (message) console.log(`message: ${message.message}\n${message.points.map((p) => `  - ${p}`).join("\n")}`)
console.log(
  `\npace x${((result.speakerPace ?? 0) / DEFAULT_RATE_CONFIG.referencePace).toFixed(2)} of reference,` +
    ` variation ${result.variation?.toFixed(2)} (monotone below ${DEFAULT_RATE_CONFIG.monotoneBelow}),` +
    ` ${result.marks.length} marks\n`,
)
for (const m of result.marks) {
  const what = m.rule === "RATE_MONOTONE" ? "" : m.text
  console.log(`${fmt(m.start).padStart(7)} ${part(m.first).padEnd(5)} ${m.rule.padEnd(20)} x${m.ratio.toFixed(2)} ${m.impact.toFixed(1)}s  ${what}`)
  if (m.slowDown) console.log(`${"".padEnd(44)}slow down: ${m.slowDown.text} (x${m.slowDown.ratio.toFixed(2)})`)
  if (m.speedUp) console.log(`${"".padEnd(44)}speed up:  ${m.speedUp.text} (x${m.speedUp.ratio.toFixed(2)})`)
}

console.log("")
for (const p of ["train", "test"]) {
  const mine = asks.filter((a) => part(a.ref.first) === p)
  const right = mine.filter((a) => touches(a.ref, a.rule)).length
  const clearGold = goldSpans.filter((g) => g.clear && part(g.words[0]) === p)
  const found = clearGold.filter((g) => asks.some((a) => a.rule === g.rule && g.words.some((i) => i >= a.ref.first && i <= a.ref.last))).length
  console.log(`${p.padEnd(5)} precision ${pct(right, mine.length).padEnd(12)} clear recall ${pct(found, clearGold.length)}`)
}

const retakePath = join(dir, "retake", "Retake-clipped.json")
if (existsSync(retakePath)) {
  const retake = await labels(wordsFromDeepgram(JSON.parse(readFileSync(retakePath, "utf8"))), "retake-")
  const good = detectRate(retake.words)
  console.log(`\nretake (good delivery): ${good.marks.length} marks, pace x${((good.speakerPace ?? 0) / DEFAULT_RATE_CONFIG.referencePace).toFixed(2)}, variation ${good.variation?.toFixed(2)}`)
  for (const m of good.marks) console.log(`${fmt(m.start).padStart(7)} ${m.rule.padEnd(20)} x${m.ratio.toFixed(2)} ${m.impact.toFixed(1)}s  ${m.rule === "RATE_MONOTONE" ? "" : m.text}`)
}

// For the annotator: marks and suggestions in the golden shape, with part and hit.
const offsets = wordOffsets(text, words)
const round = (x: number) => Math.round(x * 100) / 100
const shape = (ref: PhraseRef, rule: RateRule, extra: Record<string, unknown>) => {
  const [from, to] = [offsets[ref.first], offsets[ref.last]]
  if (!from || !to) return []
  return [{ startAt: round(ref.start), endAt: round(ref.end), startIndex: from[0], endIndex: to[1], foundationType: "rate", rule, ratio: round(ref.ratio), part: part(ref.first), ...extra }]
}
const out = join(dir, `${id}.rate.pred.json`)
const predicted = result.marks.flatMap((m) => [
  ...shape(m, m.rule, { impact: round(m.impact), hit: m.rule !== "RATE_MONOTONE" && touches(m, m.rule) }),
  ...(m.slowDown ? shape(m.slowDown, "RATE_IMPORTANCE_FAST", { suggestion: true, hit: touches(m.slowDown, "RATE_IMPORTANCE_FAST") }) : []),
  ...(m.speedUp ? shape(m.speedUp, "RATE_IMPORTANCE_SLOW", { suggestion: true, hit: touches(m.speedUp, "RATE_IMPORTANCE_SLOW") }) : []),
])
const summary = {
  model: `${strategy} · ${model}:${effort}`,
  config: DEFAULT_RATE_CONFIG,
  speakerPace: result.speakerPace,
  variation: result.variation,
  message,
  split,
  marks: predicted,
}
writeFileSync(out, JSON.stringify(summary, null, 2) + "\n")
console.log(`\nwrote ${out}`)
