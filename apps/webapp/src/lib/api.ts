import { normalizeReview, type Review, type Segment, type Take } from "@/lib/review"

export type ReviewResult = { take: Take; review: Review; audioUrl: string }

type ReviewErrorKind = "busy" | "format" | "size" | "speech" | "offline" | "failed"

export class ReviewError extends Error {
  kind: ReviewErrorKind

  constructor(message: string, kind: ReviewErrorKind) {
    super(message)
    this.kind = kind
  }
}

const MESSAGES: Record<ReviewErrorKind, string> = {
  busy: "The coach is busy right now. Wait a minute and send the take again.",
  format: "That file type isn't supported. Use a WAV, MP3, M4A, MP4 or WebM recording.",
  size: "That file is larger than 25 MB. Trim it to the minute you want reviewed.",
  speech: "The coach couldn't hear enough speech in that take. Record closer to the mic and try again.",
  offline: "The review service can't be reached. Check your connection and try again.",
  failed: "The review couldn't be completed. Your take wasn't saved; send it again.",
}

export async function requestReview(file: Blob, name: string): Promise<ReviewResult> {
  const body = new FormData()
  body.append("file", file, name)
  let response: Response
  try {
    response = await fetch("/api/review", { method: "POST", body })
  } catch {
    throw new ReviewError(MESSAGES.offline, "offline")
  }
  if (!response.ok) {
    const kind: ReviewErrorKind =
      response.status === 429 ? "busy"
      : response.status === 415 ? "format"
      : response.status === 413 ? "size"
      : response.status === 422 ? "speech"
      : response.status === 502 || response.status === 504 ? "offline"
      : "failed"
    throw new ReviewError(MESSAGES[kind], kind)
  }
  const data = (await response.json()) as { audio: string; audioType: string; segments: Segment[]; pauses?: Take["pauses"]; review: unknown }
  const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))
  const audio = new Blob([bytes], { type: data.audioType })
  const take = await measureTake(audio, data.segments, 480, data.pauses)
  return { take, review: normalizeReview(data.review, take.segments), audioUrl: URL.createObjectURL(audio) }
}

/** Draw the reviewed excerpt: waveform and recorded level from the audio, pauses from word timings. */
export async function measureTake(audio: Blob, segments: Segment[], bins = 480, measuredPauses?: Take["pauses"]): Promise<Take> {
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(await audio.arrayBuffer())
    const data = buffer.getChannelData(0)
    const size = Math.max(1, Math.floor(data.length / bins))
    const peaks: number[] = []
    const volume: number[] = []
    for (let b = 0; b < bins; b++) {
      let peak = 0
      let sum = 0
      for (let i = b * size; i < Math.min((b + 1) * size, data.length); i++) {
        const v = Math.abs(data[i])
        if (v > peak) peak = v
        sum += v * v
      }
      peaks.push(peak)
      volume.push(Math.sqrt(sum / size))
    }
    const maxPeak = Math.max(...peaks, 1e-6)
    const maxVol = Math.max(...volume, 1e-6)
    const pauses: Take["pauses"] = []
    const words = segments.flatMap((s) => s.words)
    for (let i = 1; i < words.length; i++) {
      if (words[i].start - words[i - 1].end >= 0.3) pauses.push({ start: words[i - 1].end, end: words[i].start })
    }
    return {
      duration: buffer.duration,
      peaks: peaks.map((p) => p / maxPeak),
      volume: volume.map((v) => v / maxVol),
      pauses: measuredPauses?.filter((p) => Number.isFinite(p.start) && Number.isFinite(p.end)
        && p.start >= 0 && p.end > p.start && p.end <= buffer.duration) ?? pauses,
      segments,
    }
  } finally {
    void context.close()
  }
}
