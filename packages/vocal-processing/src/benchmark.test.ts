import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { metrics, scoreRate } from "./benchmark.ts"
import type { GoldenMark } from "./golden.ts"
import { detectRate } from "./rate.ts"
import { decodeWav, findPauses } from "./pauses.ts"

const words = "One two three four five six seven eight nine ten.".split(" ").map((text, i) => ({ text, start: i * .3, end: (i + 1) * .3 }))
const text = words.map(w => w.text).join(" ")
const mark = (first: number, last: number, rule = "RATE_IMPORTANCE_FAST"): GoldenMark => ({
  startAt: words[first].start, endAt: words[last].end,
  startIndex: text.indexOf(words[first].text), endIndex: text.indexOf(words[last].text) + words[last].text.length,
  foundationType: "rate", rule,
})
test("one golden span cannot make duplicate predictions correct", () => {
  const s = scoreRate(text, words, [mark(0, 3)], [mark(0, 3), mark(0, 3)])
  assert.deepEqual([s.tp, s.fp, s.fn], [1, 1, 0])
})
test("one prediction cannot consume two golden spans; mere contact and wrong rules do not match", () => {
  assert.equal(scoreRate(text, words, [mark(0, 3), mark(4, 7)], [mark(0, 7)]).fn, 1)
  assert.equal(scoreRate(text, words, [mark(0, 0)], [mark(0, 9)]).tp, 0)
  assert.equal(scoreRate(text, words, [mark(0, 3)], [mark(0, 3, "RATE_IMPORTANCE_SLOW")]).tp, 0)
})
test("matching can reassign an earlier match to maximize distinct hits", () => {
  const s = scoreRate(text, words, [mark(0, 3), mark(4, 7)], [mark(0, 7), mark(0, 3)])
  assert.deepEqual([s.tp, s.fp, s.fn], [2, 0, 0])
})
test("phrase adjustments are scored directly, clear examples count false alarms and undefined metrics stay null", () => {
  assert.equal(scoreRate(text, words, [mark(0, 3, "RATE_IMPORTANCE_SLOW")], [mark(0, 3, "RATE_IMPORTANCE_SLOW")]).tp, 1)
  assert.equal(scoreRate(text, words, [], [mark(0, 3)]).fp, 1)
  assert.equal(scoreRate(text, words, [mark(0, 3)], []).fn, 1)
  assert.deepEqual(metrics({ tp: 0, fp: 0, fn: 0 }), { precision: null, recall: null, f1: null })
})
test("unknown rate rules are rejected instead of silently disappearing from scores", () => {
  assert.throws(() => scoreRate(text, words, [mark(0, 3, "RATE_UNKNOWN")], []), /Unknown rate rule/)
})
test("CLI gates both missed mistakes and clean false alarms", () => {
  const root = mkdtempSync(join(tmpdir(), "voice-benchmark-"))
  try {
    // A rushed take at 10 syllables/s and a normal one at 5, both on the same 12 s tone.
    const speak = (count: number, seconds: number) => Array.from({ length: count }, (_, i) => ({ text: (i + 1) % 10 ? "day" : "day.", start: i * seconds, end: (i + 1) * seconds }))
    const words = speak(60, .1), normal = speak(40, .2)
    const text = words.map(w => w.text).join(" ")
    const wav = Buffer.alloc(44 + 16000 * 12 * 2)
    wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8)
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
    wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40)
    for (let i = 0; i < 16000 * 12; i++) wav.writeInt16LE(Math.round(9000 * Math.sin(i * 2 * Math.PI * 160 / 16000)), 44 + i * 2)
    const audio = decodeWav(wav)
    const analysis = detectRate(words, {}, findPauses(audio.samples, audio.sampleRate))
    assert.ok(analysis.reliable)
    assert.deepEqual(analysis.marks.map(m => m.rule), ["RATE_IMPORTANCE_FAST"])
    const statuses = ["reviewed", "reviewed", "pending", "excluded"]
    const takes = statuses.map((status, i) => {
      const id = `rate-0${i + 1}`, base = `rate/${id}/${id}`, dir = join(root, "rate", id)
      mkdirSync(join(dir, ".cache"), { recursive: true })
      const takeWords = i === 1 ? normal : words
      writeFileSync(join(root, `${base}.txt`), takeWords.map(w => w.text).join(" "))
      writeFileSync(join(root, `${base}.wav`), wav)
      writeFileSync(join(root, `${base}.json`), JSON.stringify({ results: { channels: [{ alternatives: [{ words: takeWords.map(w => ({ word: w.text, start: w.start, end: w.end })) }] }] } }))
      const marks = i === 0 ? [{ startAt: 0, endAt: 6, startIndex: 0, endIndex: text.length, foundationType: "rate", rule: "RATE_IMPORTANCE_FAST" }] : []
      writeFileSync(join(root, `${base}.golden.json`), JSON.stringify({ schemaVersion: 2, marks, reviews: { rate: { status, notes: "" } } }))
      return { id, base, audioExtension: "wav" }
    })
    writeFileSync(join(root, "manifest.json"), JSON.stringify({ schemaVersion: 1, id: "test", takes }))
    const gate = (ids: string[]) => spawnSync(process.execPath, [join(import.meta.dirname, "../scripts/eval-rate.ts"), "--recordings-dir", root, "--recognizer-timing", "--require-pass", ...ids], { encoding: "utf8" })
    const report = () => JSON.parse(readFileSync(join(root, "rate-benchmark.json"), "utf8"))
    assert.equal(gate([]).status, 1, "unreviewed takes cannot make an incomplete suite pass")
    assert.equal(report().reviewed, 2)
    assert.equal(report().takes.find((t: { id: string }) => t.id === "rate-04").status, "excluded", "an excluded take is out of scope, not a failure")
    assert.equal(report().failed, 0)
    const good = gate(["rate-01", "rate-02"])
    assert.equal(good.status, 0, good.stderr)
    assert.deepEqual([report().totals.tp, report().totals.fp, report().totals.fn], [1, 0, 0])
    const positive = JSON.parse(readFileSync(join(root, "rate/rate-01/rate-01.golden.json"), "utf8"))
    writeFileSync(join(root, "rate/rate-02/rate-02.golden.json"), JSON.stringify(positive))
    assert.equal(gate(["rate-01", "rate-02"]).status, 1, "a missed expected correction must fail positive recall")
    assert.equal(report().totals.fn, 1)
    positive.marks = []
    writeFileSync(join(root, "rate/rate-01/rate-01.golden.json"), JSON.stringify(positive))
    writeFileSync(join(root, "rate/rate-02/rate-02.golden.json"), JSON.stringify(positive))
    assert.equal(gate(["rate-01", "rate-02"]).status, 1, "false alarms must fail the clean-reference gate")
    assert.equal(report().totals.fp, 1)
    assert.equal(report().passed, false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
