import assert from "node:assert/strict"
import { test } from "node:test"
import { decodeWav, findPauses } from "./pauses.ts"

/** A tone with silent stretches, as [seconds, loud] parts. */
function signal(parts: [number, boolean][], rate = 16000): Float32Array {
  const samples = parts.flatMap(([seconds, loud]) => Array.from({ length: Math.round(seconds * rate) }, (_, i) => loud ? 0.3 * Math.sin(i / 5) : 0.0005 * Math.sin(i)))
  return Float32Array.from(samples)
}

test("finds pauses relative to the recording's level, ignoring stop-length gaps", () => {
  const parts: [number, boolean][] = [[1, true], [0.5, false], [1, true], [0.08, false], [1, true]]
  const pauses = findPauses(signal(parts), 16000)
  assert.equal(pauses.length, 1)
  assert.ok(Math.abs(pauses[0].start - 1) < 0.02 && Math.abs(pauses[0].end - 1.5) < 0.02)
  const quiet = signal(parts).map(x => x / 50)
  assert.deepEqual(findPauses(quiet, 16000).length, 1)
})

test("decodes 16-bit PCM WAV to mono", () => {
  const rate = 8000, frames = 4
  const file = new Uint8Array(44 + frames * 4)
  const view = new DataView(file.buffer)
  const ascii = (at: number, s: string) => [...s].forEach((ch, i) => file[at + i] = ch.charCodeAt(0))
  ascii(0, "RIFF"); view.setUint32(4, 36 + frames * 4, true); ascii(8, "WAVE")
  ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true)
  ascii(36, "data"); view.setUint32(40, frames * 4, true)
  for (let i = 0; i < frames; i++) { view.setInt16(44 + i * 4, 16384, true); view.setInt16(46 + i * 4, 0, true) }
  const { samples, sampleRate } = decodeWav(file)
  assert.equal(sampleRate, rate)
  assert.deepEqual([...samples], [0.25, 0.25, 0.25, 0.25])
})
