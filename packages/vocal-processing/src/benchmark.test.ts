import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { metrics, scoreRate } from "./benchmark.ts"
import type { GoldenMark } from "./golden.ts"

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
test("CLI scores only reviewed takes, including clear takes, using cached labels without API access", () => {
  const root = mkdtempSync(join(tmpdir(), "voice-benchmark-"))
  try {
    const statuses = ["reviewed", "reviewed", "pending", "excluded"]
    const takes = statuses.map((status, i) => {
      const id = `rate-0${i + 1}`, base = `rate/${id}/${id}`, dir = join(root, "rate", id)
      mkdirSync(join(dir, ".cache"), { recursive: true })
      writeFileSync(join(root, `${base}.txt`), text)
      writeFileSync(join(root, `${base}.json`), JSON.stringify({ results: { channels: [{ alternatives: [{ words: words.map(w => ({ word: w.text, start: w.start, end: w.end })) }] }] } }))
      writeFileSync(join(root, `${base}.golden.json`), JSON.stringify({ schemaVersion: 2, marks: i === 0 ? [mark(0, 3)] : [], reviews: { rate: { status, notes: "" } } }))
      const key = createHash("sha256").update(JSON.stringify({ words, strategy: "message", model: "test-model", effort: "low", promptVersion: 1 })).digest("hex")
      writeFileSync(join(dir, ".cache", `${key}.json`), JSON.stringify({ words: words.map((w, index) => ({ ...w, index, importance: "unimportant" })) }))
      return { id, base }
    })
    writeFileSync(join(root, "manifest.json"), JSON.stringify({ schemaVersion: 1, id: "test", takes }))
    const run = spawnSync(process.execPath, [join(import.meta.dirname, "../scripts/eval-rate.ts"), "--recordings-dir", root], { encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "", IMPORTANCE_MODEL: "test-model", IMPORTANCE_EFFORT: "low" } })
    assert.equal(run.status, 0, run.stderr)
    const report = JSON.parse(readFileSync(join(root, "rate-benchmark.json"), "utf8"))
    assert.equal(report.reviewed, 2)
    assert.equal(report.cleanTakes, 1)
    assert.equal(report.totals.fn, 1)
    assert.equal(report.failed, 0)
    assert.equal(report.takes[2].status, "pending")
    assert.equal(report.takes[3].status, "excluded")
  } finally { rmSync(root, { recursive: true, force: true }) }
})
