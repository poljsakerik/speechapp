/**
 * Compare models on the golden set's rate and filler marks.
 *
 * The golden marks are weak importance labels: RATE_IMPORTANCE_FAST spans are
 * important phrases the speaker rushed, RATE_IMPORTANCE_SLOW spans are less
 * important material the speaker dwelt on, and PAUSE_FILLERS spans are filler.
 * A good model marks the first important, the second not, and the third filler.
 *
 * Word scores count matching words. Span scores ask what the coach needs: does
 * a rushed span contain an important word, is a dwelt-on span mostly
 * unimportant, and does a filler span contain filler.
 *
 *   pnpm eval:importance gpt-6-luna:low gpt-6-sol:low gpt-6-sol:medium
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { alignMarks, type GoldenMark } from "../src/golden.ts"
import { markImportance, type Importance, type Word } from "../src/importance.ts"
import { openaiCompletion, type ReasoningEffort } from "../src/openai.ts"

const RECORDINGS = join(import.meta.dirname, "../../../recordings")
const RULES = { RATE_IMPORTANCE_FAST: "important", RATE_IMPORTANCE_SLOW: "unimportant", PAUSE_FILLERS: "filler" } as const
type Rule = keyof typeof RULES
type Recording = { id: string; words: Word[]; expected: Map<number, Rule>; spans: { rule: Rule; words: number[] }[] }

function loadRecordings(): Recording[] {
  const ids = readdirSync(RECORDINGS).filter((id) => /^recording-\d+$/.test(id))
  return ids.flatMap((id) => {
    const golden = join(RECORDINGS, id, `${id}.golden.json`)
    if (!existsSync(golden)) return []
    const marks = (JSON.parse(readFileSync(golden, "utf8")) as GoldenMark[]).filter((m) => m.rule in RULES)
    if (!marks.length) return []
    const text = readFileSync(join(RECORDINGS, id, `${id}.txt`), "utf8")
    const words = wordsFromDeepgram(JSON.parse(readFileSync(join(RECORDINGS, id, `${id}.json`), "utf8")))
    const spans = alignMarks(text, words, marks).map((covered, k) => ({ rule: marks[k].rule as Rule, words: covered }))
    const expected = new Map<number, Rule>()
    for (const span of spans) for (const i of span.words) if (!expected.has(i)) expected.set(i, span.rule)
    return [{ id, words, expected, spans: spans.filter((s) => s.words.length) }]
  })
}

const specs = process.argv.slice(2)
if (!specs.length) throw new Error("Usage: pnpm eval:importance <model[:effort]> ...")
const recordings = loadRecordings()
console.log(`Golden words: ${recordings.map((r) => `${r.id} ${r.expected.size}/${r.words.length}`).join(", ")}`)
console.log("Scores are fast→important, slow→unimportant, fillers→filler.\n")

for (const spec of specs) {
  const [model, effort = "low"] = spec.split(":")
  const complete = openaiCompletion({ model, effort: effort as ReasoningEffort })
  const hits: Record<Rule, [number, number]> = { RATE_IMPORTANCE_FAST: [0, 0], RATE_IMPORTANCE_SLOW: [0, 0], PAUSE_FILLERS: [0, 0] }
  const spanHits: Record<Rule, [number, number]> = { RATE_IMPORTANCE_FAST: [0, 0], RATE_IMPORTANCE_SLOW: [0, 0], PAUSE_FILLERS: [0, 0] }
  const share: Record<Importance, number> = { message: 0, important: 0, unimportant: 0, filler: 0 }
  let total = 0
  const started = performance.now()
  let failed = ""
  for (const recording of recordings) {
    let words
    try {
      ;({ words } = await markImportance(recording.words, { complete }))
    } catch (error) {
      failed = (error as Error).message.slice(0, 120)
      break
    }
    for (const w of words) {
      share[w.importance]++
      total++
      const rule = recording.expected.get(w.index)
      if (!rule) continue
      hits[rule][1]++
      if (w.importance === RULES[rule]) hits[rule][0]++
    }
    for (const span of recording.spans) {
      const labels = span.words.map((i) => words[i].importance)
      const count = (label: Importance) => labels.filter((l) => l === label).length
      const hit =
        span.rule === "RATE_IMPORTANCE_FAST" ? count("important") > 0
        : span.rule === "RATE_IMPORTANCE_SLOW" ? count("important") <= labels.length / 2
        : count("filler") > 0
      spanHits[span.rule][1]++
      if (hit) spanHits[span.rule][0]++
    }
  }
  if (failed) {
    console.log(`${spec.padEnd(22)} failed: ${failed}`)
    continue
  }
  const seconds = (performance.now() - started) / 1000
  const pct = ([hit, of]: [number, number]) => (of ? `${Math.round((100 * hit) / of)}%` : "-")
  const scores = (h: typeof hits) =>
    [h.RATE_IMPORTANCE_FAST, h.RATE_IMPORTANCE_SLOW, h.PAUSE_FILLERS].map((x) => pct(x).padStart(4)).join(" ")
  console.log(
    `${spec.padEnd(20)} words ${scores(hits)}  | spans ${scores(spanHits)}` +
      `  | important ${pct([share.important, total])}, filler ${pct([share.filler, total])}` +
      `  | ${seconds.toFixed(1)}s`,
  )
}
