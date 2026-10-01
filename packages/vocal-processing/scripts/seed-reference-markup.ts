/** Apply the first reference-based draft without replacing subsequent human annotations. */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { loadAnnotation, loadCorpus, type Annotation } from "../src/benchmark.ts"
import { wordsFromDeepgram } from "../src/deepgram.ts"
import { wordOffsets } from "../src/golden.ts"

const { values } = parseArgs({ options: { "recordings-dir": { type: "string" } } })
const root = resolve(import.meta.dirname, "../../..")
const recordings = resolve(values["recordings-dir"] ?? join(root, "recordings"))
const corpus = loadCorpus(recordings)
const recipe = JSON.parse(readFileSync(join(root, "benchmarks/voice-pack-20261001.markup.json"), "utf8")) as {
  corpus: string; method: string; referenceTakes: Record<string, string>;
  drafts: { id: string; notes: string; marks: { first: number; last: number; rule: string; note: string }[] }[];
}
if (recipe.corpus !== corpus.id) throw new Error("Markup recipe does not match corpus")
const changes = corpus.takes.map(take => {
  const base = join(recordings, take.base), previous = loadAnnotation(base)
  const draft = recipe.drafts.find(d => d.id === take.id)
  const isReference = recipe.referenceTakes[take.foundation] === take.id
  if (!isReference && !draft) throw new Error(`No reference or draft for ${take.id}`)
  const words = wordsFromDeepgram(JSON.parse(readFileSync(`${base}.json`, "utf8")))
  const text = readFileSync(`${base}.txt`, "utf8"), offsets = wordOffsets(text, words)
  const marks = (draft?.marks ?? []).map(m => {
    const from = offsets[m.first], to = offsets[m.last], first = words[m.first], last = words[m.last]
    if (!from || !to || first.start === undefined || last.end === undefined) throw new Error(`Invalid word span in ${take.id}`)
    return { startAt: +first.start.toFixed(2), endAt: +last.end.toFixed(2), startIndex: from[0], endIndex: to[1], foundationType: take.foundation, rule: m.rule, note: m.note }
  })
  const notes = isReference ? `User-designated good reference for ${take.foundation}: ${take.id}. No issue marks for this foundation. Other foundations are not implicitly reviewed.` : `${draft!.notes}\n\nMethod: ${recipe.method}`
  const review = { status: isReference ? "reviewed" as const : "pending" as const, notes }
  const oldMarks = previous.marks.filter(m => m.foundationType === take.foundation)
  const oldReview = previous.reviews[take.foundation]
  const unchanged = JSON.stringify(oldMarks) === JSON.stringify(marks) && JSON.stringify(oldReview) === JSON.stringify(review)
  if (!unchanged && (oldMarks.length || oldReview?.status === "reviewed" || oldReview?.status === "excluded" || oldReview?.notes)) {
    throw new Error(`Existing annotations in ${take.id}; refusing to overwrite them. Apply any remaining drafts manually.`)
  }
  const next: Annotation = { schemaVersion: 2, marks: [...previous.marks.filter(m => m.foundationType !== take.foundation), ...marks], reviews: { ...previous.reviews, [take.foundation]: review } }
  return { id: take.id, path: `${base}.golden.json`, previous, next, unchanged }
})
const backup = join(recordings, ".annotation-history")
mkdirSync(backup, { recursive: true })
writeFileSync(join(backup, `before-reference-markup-${Date.now()}.json`), JSON.stringify({ manifest: corpus, annotations: Object.fromEntries(changes.map(c => [c.id, c.previous])) }, null, 2) + "\n")
for (const c of changes) {
  if (!c.unchanged) {
    writeFileSync(`${c.path}.tmp`, JSON.stringify(c.next, null, 2) + "\n")
    renameSync(`${c.path}.tmp`, c.path)
  }
  console.log(`${c.id}: ${c.next.marks.length} marks; ${c.next.reviews[corpus.takes.find(t => t.id === c.id)!.foundation].status}`)
}
writeFileSync(join(recordings, "manifest.json.tmp"), JSON.stringify({ ...corpus, referenceTakes: recipe.referenceTakes }, null, 2) + "\n")
renameSync(join(recordings, "manifest.json.tmp"), join(recordings, "manifest.json"))
console.log("User-selected references are reviewed; all assistant issue marks are drafts pending review.")
