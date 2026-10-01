/** Evaluate frozen defaults; never tune here. Crops are diagnostic only.
 * pnpm eval:pauses [recording IDs...] [--include-crops] [--fresh] [--cached-only]
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { alignMarks, wordOffsets, type GoldenMark } from "../src/golden.ts"
import { markMessage, MESSAGE_MARKING_PROMPT, MESSAGE_PROMPT } from "../src/importance.ts"
import { openaiCompletion } from "../src/openai.ts"
import { DEFAULT_PAUSE_CONFIG, PAUSE_BOUNDARY_SCHEMA, PAUSE_CONTEXT_PROMPT, detectPauses, type PauseRule } from "../src/pauses.ts"
import { matchPauseMarks, sourceGroup } from "../src/pause-evaluation.ts"

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  "include-crops": { type: "boolean", default: false }, fresh: { type: "boolean", default: false }, "cached-only": { type: "boolean", default: false },
} })
const root = join(import.meta.dirname, "../../../recordings")
const model = process.env.IMPORTANCE_MODEL ?? "gpt-6-sol"
const effort = process.env.IMPORTANCE_EFFORT ?? "low"
const rules: PauseRule[] = ["PAUSE_NECESSARY", "PAUSE_UNNECESSARY", "PAUSE_FILLERS"]
const ids = positionals.length ? positionals : readdirSync(root).filter((id) =>
  /^recording-\d+(?:-[a-z]+)?$/.test(id) && existsSync(join(root, id, `${id}.golden.json`))
  && (values["include-crops"] || id === sourceGroup(id)))
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const totals = new Map<string, { predicted: number; matched: number; gold: number; groups: Set<string> }>()
const pooledGroups = new Set<string>()
const fraction = (a: number, b: number) => b ? `${a}/${b} (${Math.round(a / b * 100)}%)` : "n/a"

for (const id of [...ids].sort((a, b) => (a === sourceGroup(a) ? 0 : 1) - (b === sourceGroup(b) ? 0 : 1) || a.localeCompare(b))) {
  if (!/^recording-\d+(?:-[a-z]+)?$/.test(id)) throw new Error(`Invalid recording ID: ${id}`)
  const dir = join(root, id)
  const words = wordsFromDeepgram(JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")))
  const transcript = readFileSync(join(dir, `${id}.txt`), "utf8")
  const key = hash(JSON.stringify({ version: 1, words, model, effort, MESSAGE_PROMPT, MESSAGE_MARKING_PROMPT, PAUSE_CONTEXT_PROMPT, PAUSE_BOUNDARY_SCHEMA }))
  const cache = join(dir, ".cache", `pauses-${key}.json`)
  if (values["cached-only"] && !existsSync(cache)) { console.log(`${id}: no matching cache; skipped`); continue }
  const labeled: Awaited<ReturnType<typeof markMessage>> = existsSync(cache) && !values.fresh
    ? JSON.parse(readFileSync(cache, "utf8"))
    : await markMessage(words, { complete: openaiCompletion(), analyzePauses: true })
  mkdirSync(join(dir, ".cache"), { recursive: true })
  writeFileSync(cache, JSON.stringify(labeled))
  const result = detectPauses(labeled.words, labeled.pauseBoundaries ?? [])
  const goldenPath = join(dir, `${id}.golden.json`)
  const golden: GoldenMark[] = existsSync(goldenPath) ? JSON.parse(readFileSync(goldenPath, "utf8")) : []
  const pauseGold = golden.filter((g) => rules.includes(g.rule as PauseRule))
  const aligned = alignMarks(transcript, words, pauseGold)
  const gold = pauseGold.map((g, i) => ({ rule: g.rule, words: aligned[i] })).filter((g) => g.words.length)
  const group = sourceGroup(id)
  // Stable source-group split, independent of annotation counts or detector output.
  const partition = parseInt(hash(group).slice(0, 8), 16) % 5 === 0 ? "held-out" : "development"
  const scored = gold.length > 0
  const pooled = scored && !pooledGroups.has(group)
  console.log(`\n${id} · ${partition} · source ${group}${!scored ? " · unannotated (no precision/recall claim)" : !pooled ? " · crop diagnostic, excluded from totals" : ""}`)
  if (pauseGold.length !== gold.length) console.log(`Unaligned annotations excluded: ${pauseGold.length - gold.length}`)
  for (const rule of rules) {
    const mine = result.candidates.filter((m) => m.rule === rule)
    const expected = gold.filter((g) => g.rule === rule)
    const hits = matchPauseMarks(mine, expected).matchedPredictions.size
    console.log(`${rule}: ${mine.length} candidates${scored ? `; precision ${fraction(hits, mine.length)}; recall ${fraction(hits, expected.length)}` : ""}`)
    if (pooled) {
      const label = `${partition} ${rule}`
      const total = totals.get(label) ?? { predicted: 0, matched: 0, gold: 0, groups: new Set<string>() }
      total.predicted += mine.length; total.matched += hits; total.gold += expected.length; total.groups.add(group)
      totals.set(label, total)
    }
  }
  if (pooled) pooledGroups.add(group)
  const hits = matchPauseMarks(result.candidates, gold)
  const selected = matchPauseMarks(result.marks, gold)
  console.log(`Selected: ${result.marks.length} notes${scored ? `; precision ${fraction(selected.matchedPredictions.size, result.marks.length)}; recall ${fraction(selected.matchedGolden.size, gold.length)}` : ""}`)
  const offsets = wordOffsets(transcript, words)
  const output = { model: `${model}:${effort}`, config: DEFAULT_PAUSE_CONFIG, message: labeled.message,
    sourceGroup: group, partition, assessedBoundaries: result.assessedBoundaries,
    marks: result.candidates.flatMap((m, i) => {
      const first = offsets[m.first], last = offsets[m.last]
      return first && last ? [{ startAt: m.start, endAt: m.end, at: m.at, startIndex: first[0], endIndex: last[1],
        foundationType: "pauses", rule: m.rule, observedSeconds: m.observedSeconds,
        part: partition, hit: scored ? hits.matchedPredictions.has(i) : null, selected: result.marks.includes(m) }] : []
    }) }
  writeFileSync(join(dir, `${id}.pauses.pred.json`), JSON.stringify(output, null, 2) + "\n")
}
console.log("\nSource-group totals (candidate matches; no within-recording train/test split):")
for (const [label, total] of totals) console.log(`${label}: ${total.groups.size} sources; precision ${fraction(total.matched, total.predicted)}; recall ${fraction(total.matched, total.gold)}`)
console.log("Defaults were not tuned. Sparse annotations and one speaker/source family do not establish coaching accuracy on new deliveries.")
