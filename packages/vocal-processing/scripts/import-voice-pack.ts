/** Import the curated paragraph takes without splitting intentional in-paragraph pauses. */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { transcribe } from "../src/deepgram.ts"

const { values } = parseArgs({ options: {
  archive: { type: "string" }, ffmpeg: { type: "string", default: process.env.FFMPEG ?? "ffmpeg" },
  "transcripts-dir": { type: "string" }, output: { type: "string" }, replace: { type: "boolean", default: false },
} })
if (!values.archive) throw new Error("Usage: pnpm import:voice-pack --archive <zip> [--ffmpeg <binary>] [--transcripts-dir <cached source transcripts>] [--output <recordings>] [--replace]")
const root = resolve(import.meta.dirname, "../../..")
const requestedOutput = resolve(values.output ?? join(root, "recordings"))
const output = existsSync(requestedOutput) ? realpathSync(requestedOutput) : requestedOutput
if (existsSync(output) && !values.replace) throw new Error(`${output} exists; pass --replace to archive it and import the new corpus`)
type Source = { sampleRate: number; file: string; sha256: string; foundation: string; assignment: string; evidence: string; takes: { id: string; start: number; end: number }[] }
const recipe = JSON.parse(readFileSync(join(root, "benchmarks/voice-pack-20261001.json"), "utf8")) as { id: string; sources: Source[]; referenceTakes?: Record<string, string> }
mkdirSync(dirname(output), { recursive: true })
const staging = mkdtempSync(join(dirname(output), ".voice-pack-"))
const manifest = { schemaVersion: 1, id: recipe.id, referenceTakes: recipe.referenceTakes ?? {}, takes: [] as Record<string, unknown>[] }
try {
  for (const source of recipe.sources) {
    const audio = execFileSync("unzip", ["-p", resolve(values.archive), source.file], { maxBuffer: 20 * 1024 * 1024 })
    if (createHash("sha256").update(audio).digest("hex") !== source.sha256) throw new Error(`Source checksum mismatch: ${source.file}`)
    const sourceDir = join(staging, source.foundation, "source")
    mkdirSync(sourceDir, { recursive: true })
    const sourcePath = join(sourceDir, source.file)
    writeFileSync(sourcePath, audio)
    const cached = values["transcripts-dir"] && join(values["transcripts-dir"], `${source.file}.json`)
    const response = cached && existsSync(cached) ? JSON.parse(readFileSync(cached, "utf8")) : await transcribe(audio)
    writeFileSync(`${sourcePath}.json`, JSON.stringify(response, null, 2) + "\n")
    const sourceWords = response.results.channels[0].alternatives[0].words as { word: string; punctuated_word?: string; start: number; end: number }[]
    for (const [i, take] of source.takes.entries()) {
      const dir = join(staging, source.foundation, take.id)
      mkdirSync(dir, { recursive: true })
      const base = join(dir, take.id)
      // PCM preserves the original level, pitch and pauses; never normalize benchmark audio.
      execFileSync(values.ffmpeg!, ["-v", "error", "-i", sourcePath, "-af", `atrim=start_sample=${Math.round(take.start * source.sampleRate)}:end_sample=${Math.round(take.end * source.sampleRate)},asetpts=PTS-STARTPTS`, "-c:a", "pcm_s16le", `${base}.wav`])
      const selected = sourceWords.filter(w => w.start >= take.start && w.end <= take.end)
      if (!selected.length || selected[0].word.toLowerCase() !== "most" || selected.at(-1)!.word.toLowerCase() !== "level") throw new Error(`Incomplete paragraph: ${take.id}`)
      const words = selected.map(w => ({ ...w, start: +(w.start - take.start).toFixed(6), end: +(w.end - take.start).toFixed(6) }))
      const transcript = words.map(w => w.punctuated_word ?? w.word).join(" ")
      const duration = +(take.end - take.start).toFixed(6)
      writeFileSync(`${base}.txt`, transcript + "\n")
      writeFileSync(`${base}.json`, JSON.stringify({ metadata: { duration, source: source.file, sourceStart: take.start, timing: "Deepgram source timestamps rebased to take" }, results: { channels: [{ alternatives: [{ transcript, words }] }] } }, null, 2) + "\n")
      writeFileSync(`${base}.golden.json`, JSON.stringify({ schemaVersion: 2, marks: [], reviews: {} }, null, 2) + "\n")
      manifest.takes.push({ id: take.id, foundation: source.foundation, take: i + 1, base: `${source.foundation}/${take.id}/${take.id}`, audioExtension: "wav", duration, source: source.file, sourceStart: take.start, sourceEnd: take.end, assignment: source.assignment, evidence: source.evidence })
      console.log(`${take.id}: ${duration}s, ${words.length} words`)
    }
  }
  writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  if (existsSync(output)) {
    const backup = `${output}-archive-${Date.now()}`
    renameSync(output, backup)
    console.log(`Previous recordings moved out of the corpus to ${backup}`)
  }
  renameSync(staging, output)
  console.log(`Imported ${manifest.takes.length} takes to ${output}. All annotations are pending human review.`)
} finally {
  if (existsSync(staging)) rmSync(staging, { recursive: true })
}
