import { PitchDetector } from "pitchy"

export type ProsodyFrame = { time: number; pitch: number; db: number }
export type ProsodyEvidence = {
  voicedSeconds: number
  voicedFraction: number
  /** Largest robust excursion within a continuous pitch track, in semitones. */
  pitchExcursion: number
  /** Point median minus nearby speech median, in semitones. */
  pitchShift?: number
  /** Point voiced level minus nearby voiced level, in dB; microphone gain cancels. */
  levelChange?: number
}

/**
 * Local acoustic evidence, not a pitch/monotony grade. McLeod pitch estimates
 * use 60 ms frames every 10 ms. A two-pole low-pass reduces strong harmonics;
 * low clarity, out-of-range estimates, and isolated pitch values are rejected.
 * No speaker's identity, mean pitch, microphone level, or reference recording
 * is needed. The broad 50–600 Hz range is a measurement limit, not a voice norm.
 */
export function measureProsody(samples: Float32Array, sampleRate: number): ProsodyFrame[] {
  if (!Number.isFinite(sampleRate) || sampleRate < 2000) throw new Error("Invalid prosody sample rate")
  const n = Math.round(sampleRate * 0.06), hop = Math.round(sampleRate * 0.01)
  if (samples.length < n) return []
  const filtered = new Float32Array(samples.length)
  const alpha = 1 - Math.exp(-2 * Math.PI * 600 / sampleRate)
  let a = 0, b = 0
  for (let i = 0; i < samples.length; i++) {
    a += alpha * (samples[i] - a); b += alpha * (a - b); filtered[i] = b
  }
  const detector = PitchDetector.forFloat32Array(n)
  const frames: ProsodyFrame[] = []
  for (let i = 0; i + n <= samples.length; i += hop) {
    let energy = 0
    for (let j = i; j < i + n; j++) energy += samples[j] ** 2
    const [pitch, clarity] = detector.findPitch(filtered.subarray(i, i + n), sampleRate)
    frames.push({ time: (i + n / 2) / sampleRate, pitch: clarity >= 0.75 && pitch >= 50 && pitch <= 600 ? pitch : 0, db: 10 * Math.log10(energy / n + 1e-12) })
  }
  const floor = quantile(frames.map(f => f.db), 0.99)! - 25
  return frames.map((f, i) => {
    const neighbors = frames.slice(Math.max(0, i - 2), i + 3)
      .filter(g => g.pitch && f.pitch && Math.abs(semitones(g.pitch / f.pitch)) < 3)
    return { ...f, pitch: f.db >= floor && neighbors.length >= 3 ? f.pitch : 0 }
  })
}

/** Measurements over the selected passage. These never automatically clear a rate candidate. */
export function pointProsody(frames: ProsodyFrame[], start: number, end: number): ProsodyEvidence {
  const inside = frames.filter(f => f.time >= start && f.time <= end)
  const voiced = inside.filter(f => f.pitch > 0)
  const middle = (start + end) / 2
  const around = frames.filter(f => f.pitch > 0 && Math.abs(f.time - middle) <= 3 && (f.time < start || f.time > end))
  const tracks: ProsodyFrame[][] = []
  for (const f of voiced) {
    const last = tracks.at(-1), previous = last?.at(-1)
    // Abrupt jumps and separated islands can be octave errors, not intonation.
    if (previous && f.time - previous.time <= 0.12 && Math.abs(semitones(f.pitch / previous.pitch)) < 4) last!.push(f)
    else tracks.push([f])
  }
  const pitchExcursion = Math.max(0, ...tracks.filter(t => t.length >= 8).map(t => {
    const pitches = t.map(f => semitones(f.pitch))
    return quantile(pitches, 0.9)! - quantile(pitches, 0.1)!
  }))
  const voicedSeconds = voiced.length * 0.01, voicedFraction = inside.length ? voiced.length / inside.length : 0
  const enough = voicedSeconds >= 0.15 && voicedFraction >= 0.25
  return {
    voicedSeconds, voicedFraction, pitchExcursion,
    ...(enough && around.length >= 15 ? {
      pitchShift: semitones(quantile(voiced.map(f => f.pitch), 0.5)! / quantile(around.map(f => f.pitch), 0.5)!),
      levelChange: quantile(voiced.map(f => f.db), 0.8)! - quantile(around.map(f => f.db), 0.8)!,
    } : {}),
  }
}

const semitones = (ratio: number) => 12 * Math.log2(ratio)
function quantile(xs: number[], p: number): number | undefined {
  if (!xs.length) return undefined
  return xs.sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)]
}
