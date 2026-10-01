import assert from "node:assert/strict"
import { test } from "node:test"
import { measureProsody, pointProsody, type ProsodyFrame } from "./prosody.ts"

function tone(base: number, sweep: number, gain = 0.3) {
  const samples = new Float32Array(16000)
  let phase = 0
  for (let i = 0; i < samples.length; i++) {
    phase += 2 * Math.PI * base * 2 ** (sweep * i / samples.length / 12) / 16000
    samples[i] = gain * (Math.sin(phase) + 0.2 * Math.sin(2 * phase))
  }
  return samples
}

test("pitch movement is relative across voice registers and recording gains", () => {
  for (const base of [90, 180, 300]) for (const gain of [0.03, 0.3]) {
    const flat = pointProsody(measureProsody(tone(base, 0, gain), 16000), 0, 1)
    assert.ok(flat.voicedFraction > 0.9)
    assert.ok(flat.pitchExcursion < 0.1)
    const moving = pointProsody(measureProsody(tone(base, 9, gain), 16000), 0, 1)
    assert.ok(moving.pitchExcursion > 6 && moving.pitchExcursion < 8)
  }
})

test("silence, short audio, and octave errors cannot manufacture emphasis evidence", () => {
  assert.deepEqual(measureProsody(new Float32Array(100), 16000), [])
  assert.equal(pointProsody(measureProsody(new Float32Array(16000), 16000), 0, 1).pitchExcursion, 0)
  const jump: ProsodyFrame[] = Array.from({ length: 100 }, (_, i) => ({ time: i / 100, db: -20, pitch: i < 50 ? 100 : 200 }))
  assert.equal(pointProsody(jump, 0, 1).pitchExcursion, 0, "disconnected octaves are not a continuous pitch excursion")
  assert.throws(() => measureProsody(tone(100, 0), 0), /sample rate/)
})
