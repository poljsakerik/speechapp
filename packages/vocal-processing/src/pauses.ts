/**
 * Silent pauses measured from the audio itself.
 *
 * Recognizers stretch word timestamps over the silence around them (Deepgram
 * words usually touch, with no gap at all), so a pause that frames a point can
 * vanish from the transcript. This finds the silences directly: 10 ms frames
 * more than `belowPeak` dB under the recording's loud frames. The threshold is
 * relative, so recording level and microphone gain don't matter. Silences
 * shorter than `minSeconds` are mostly stop-consonant closures, not pauses.
 */
export type Pause = { start: number; end: number }

export type PauseOptions = {
  /** Frames this many dB below the 99th-percentile frame level are silent. */
  belowPeak?: number
  /** Shorter silences are not pauses (about 0.2 s is where listeners hear one). */
  minSeconds?: number
  /** Silences separated by less than this (seconds) are one pause. */
  joinGap?: number
}

export function findPauses(samples: Float32Array, sampleRate: number, options: PauseOptions = {}): Pause[] {
  const { belowPeak = 25, minSeconds = 0.2, joinGap = 0.05 } = options
  const step = 0.01
  const frame = Math.round(sampleRate * step)
  const levels: number[] = []
  for (let from = 0; from + frame <= samples.length; from += frame) {
    let sum = 0
    for (let i = from; i < from + frame; i++) sum += samples[i] ** 2
    levels.push(10 * Math.log10(sum / frame + 1e-12))
  }
  if (!levels.length) return []
  const floor = [...levels].sort((a, b) => a - b)[Math.floor(levels.length * 0.99)] - belowPeak
  const pauses: Pause[] = []
  for (let f = 0; f < levels.length;) {
    if (levels[f] >= floor) { f++; continue }
    let g = f
    while (g < levels.length && levels[g] < floor) g++
    const last = pauses[pauses.length - 1]
    if (last && f * step - last.end <= joinGap) last.end = g * step
    else pauses.push({ start: f * step, end: g * step })
    f = g
  }
  return pauses.filter((p) => p.end - p.start >= minSeconds)
}

/** Mono samples of a PCM WAV file (16-bit integer or 32-bit float); channels are averaged. */
export function decodeWav(file: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  const tag = (at: number) => String.fromCharCode(...file.subarray(at, at + 4))
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file")
  let format = 0, channels = 0, sampleRate = 0, bits = 0
  let data: [number, number] | undefined
  for (let at = 12; at + 8 <= file.length;) {
    const size = view.getUint32(at + 4, true)
    if (tag(at) === "fmt ") {
      format = view.getUint16(at + 8, true)
      channels = view.getUint16(at + 10, true)
      sampleRate = view.getUint32(at + 12, true)
      bits = view.getUint16(at + 22, true)
    }
    if (tag(at) === "data") data = [at + 8, Math.min(size, file.length - at - 8)]
    at += 8 + size + (size % 2)
  }
  const pcm16 = format === 1 && bits === 16
  const float32 = format === 3 && bits === 32
  if (!data || !channels || !(pcm16 || float32)) throw new Error("Only 16-bit PCM and 32-bit float WAV files are supported")
  const bytes = bits / 8
  const samples = new Float32Array(Math.floor(data[1] / bytes / channels))
  for (let i = 0; i < samples.length; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      const at = data[0] + (i * channels + c) * bytes
      sum += pcm16 ? view.getInt16(at, true) / 32768 : view.getFloat32(at, true)
    }
    samples[i] = sum / channels
  }
  return { samples, sampleRate }
}
