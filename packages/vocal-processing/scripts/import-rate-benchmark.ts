/** Import annotated teaching and ordinary-speech excerpts from a benchmark recipe. Never overwrite a corpus. */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import type { Corpus } from "../src/benchmark.ts"
import { transcribe } from "../src/deepgram.ts"

const { values } = parseArgs({ options: {
  "videos-dir": { type: "string" }, "speech-dir": { type: "string" }, "transcripts-dir": { type: "string" },
  output: { type: "string" }, recipe: { type: "string" }, ffmpeg: { type: "string", default: process.env.FFMPEG ?? "ffmpeg" },
} })
if (!values["videos-dir"]) throw new Error("Usage: node scripts/import-rate-benchmark.ts --videos-dir <videos> [--recipe <benchmarks/*.json>] [--speech-dir <practice-sources>] [--transcripts-dir <cache>] [--output <corpus>] [--ffmpeg <binary>]")
const root = resolve(import.meta.dirname, "../../..")
type Source = { kind?: string; file: string; sha256: string; foundation: string; takes: { id: string; start: number; end: number; note?: string; [foundation: string]: unknown; marks: { start: number; end: number; rule: string; note: string }[] }[] }
type SourceWord = { word: string; punctuated_word?: string; start: number; end: number }
const recipe = JSON.parse(readFileSync(resolve(values.recipe ?? join(root, "benchmarks/rate-development.json")), "utf8")) as { id: string; foundation?: string; purpose: string; sources: Source[] }
// The benchmark's foundation; a source's own foundation only names its folder.
const foundation = recipe.foundation ?? "rate"
const output = resolve(values.output ?? join(root, `recordings-${recipe.id}`))
if (existsSync(output)) throw new Error(`${output} exists; choose a new output to preserve annotations`)
mkdirSync(dirname(output), { recursive: true })
const staging = mkdtempSync(join(dirname(output), ".reference-"))
const manifest: Corpus = { schemaVersion: 1, id: recipe.id, takes: [] }
try {
  for (const source of recipe.sources) {
    const sourcePath = resolve(source.kind === "practice" ? values["speech-dir"] ?? values["videos-dir"] : values["videos-dir"], source.file)
    const audio = readFileSync(sourcePath)
    if (createHash("sha256").update(audio).digest("hex") !== source.sha256) throw new Error(`Source checksum mismatch: ${source.file}`)
    const cacheRoot = source.kind === "practice" ? values["speech-dir"] : values["transcripts-dir"]
    const cached = cacheRoot && join(cacheRoot, `${basename(source.file, extname(source.file))}.deepgram.json`)
    const response = cached && existsSync(cached) ? JSON.parse(readFileSync(cached, "utf8")) : await transcribe(audio)
    const sourceWords = response.results.channels[0].alternatives[0].words as SourceWord[]
    const sourceDir = join(staging, source.foundation, "source")
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, `${source.file}.json`), JSON.stringify(response, null, 2) + "\n")
    let previousEnd = 0
    for (const take of source.takes) {
      if (!(take.start >= previousEnd && take.end > take.start) || !/^[a-z_]+-\d+$/.test(take.id) || manifest.takes.some(t => t.id === take.id)) throw new Error(`Invalid cut: ${take.id}`)
      previousEnd = take.end
      const relativeBase = `${source.foundation}/${take.id}/${take.id}`
      const base = join(staging, relativeBase)
      mkdirSync(dirname(base), { recursive: true })
      // Preserve internal pauses and levels; trim before downsampling for analysis.
      execFileSync(values.ffmpeg!, ["-v", "error", "-i", sourcePath, "-vn", "-af", `atrim=start=${take.start}:end=${take.end},asetpts=PTS-STARTPTS`, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", `${base}.wav`])
      const duration = +(take.end - take.start).toFixed(6)
      // ASR edges smear into silence. Select by midpoint, clamp only at the cut,
      // and retain the original response for auditing instead of dropping edge words.
      const words = sourceWords.filter(w => (w.start + w.end) / 2 >= take.start && (w.start + w.end) / 2 < take.end)
        .map(w => ({ ...w, start: +Math.max(0, w.start - take.start).toFixed(6), end: +Math.min(duration, w.end - take.start).toFixed(6) }))
      if (!words.length || words.some(w => !(w.end > w.start))) throw new Error(`Invalid transcript: ${take.id}`)
      const transcript = words.map(w => w.punctuated_word ?? w.word).join(" ")
      writeFileSync(`${base}.txt`, transcript + "\n")
      writeFileSync(`${base}.json`, JSON.stringify({ metadata: { duration, source: source.file, sourceStart: take.start, timing: "Deepgram source timestamps rebased and clamped to take" }, results: { channels: [{ alternatives: [{ transcript, words }] }] } }, null, 2) + "\n")
      writeFileSync(`${base}.context.txt`, sourceWords.map(w => w.punctuated_word ?? w.word).join(" ") + "\n")
      const marks = take.marks.map(mark => {
        const selected = words.map((w, index) => ({ ...w, index })).filter(w => (w.start + w.end) / 2 + take.start >= mark.start && (w.start + w.end) / 2 + take.start < mark.end)
        if (!selected.length || mark.start < take.start || mark.end > take.end) throw new Error(`Invalid annotation: ${take.id}`)
        const first = selected[0], last = selected.at(-1)!
        const startIndex = words.slice(0, first.index).reduce((s, w) => s + (w.punctuated_word ?? w.word).length + 1, 0)
        const endIndex = words.slice(0, last.index + 1).reduce((s, w) => s + (w.punctuated_word ?? w.word).length + 1, 0) - 1
        return { startAt: first.start, endAt: last.end, startIndex, endIndex, foundationType: foundation, rule: mark.rule, note: mark.note }
      })
      const provenance = "Provisional development annotations from transcript and acoustic inspection, chosen before detector evaluation. User-authorized Vinh and practice excerpts. Not independently listener-validated."
      // A take may set its status for the benchmark's foundation, e.g. { "rate": { "status": "excluded", "notes": "..." } }.
      const status = take[foundation] as { status: "reviewed" | "excluded"; notes: string } | undefined
      const reviews = { [foundation]: { status: status?.status ?? "reviewed", notes: [take.note, status?.notes, provenance].filter(Boolean).join(" ") } }
      writeFileSync(`${base}.golden.json`, JSON.stringify({ schemaVersion: 2, marks, reviews }, null, 2) + "\n")
      manifest.takes.push({ id: take.id, foundation, take: manifest.takes.length + 1, base: relativeBase, audioExtension: "wav", duration, source: source.file, sourceStart: take.start, sourceEnd: take.end, assignment: source.kind === "practice" ? (marks.length ? `Practice: ${foundation} correction` : `Practice: clean ${foundation} control`) : marks.length ? `Demonstration: ${foundation}` : `Clean ${foundation} reference`, evidence: `benchmarks/${recipe.id}.json` })
      console.log(`${take.id}: ${duration}s, ${words.length} words`)
    }
  }
  writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  writeFileSync(join(staging, "recipe.json"), JSON.stringify(recipe, null, 2) + "\n")
  renameSync(staging, output)
  console.log(`Imported ${manifest.takes.length} annotated ${foundation} takes to ${output}`)
} finally {
  if (existsSync(staging)) rmSync(staging, { recursive: true })
}
