/**
 * How expressive a voice sounds, rated 1-5 by Gemini, an audio language model.
 *
 * Audio language models tend to judge the words rather than the voice, so this
 * was tested with the words filtered out (400 Hz low-pass): Gemini 3.5 Flash
 * still rated Vinh's teaching above every one of your talks and your expressive
 * reading above your flat one. The prompt is the one measured; changing it
 * needs the same checks (docs/tonality-research.md).
 */
import { setTimeout as sleep } from "node:timers/promises"
import type { VoiceRating } from "./tonality.ts"

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

export const VOICE_PROMPT = "Rate how emotionally expressive this speaker's voice sounds: the emotion underneath the voice, not what the words say and not the recording quality. " +
  "1 = flat, blank, emotionless; 2 = mostly flat; 3 = ordinary; 4 = clearly expressive; 5 = vivid, emotionally alive. " +
  'Reply with JSON only: {"expressiveness": <1-5>}'

/** One model configuration for live reviews and benchmark cache keys. */
export function geminiSettings(env: NodeJS.ProcessEnv = process.env): { model: string } {
  return { model: env.GEMINI_MODEL ?? "gemini-3.5-flash" }
}

export type GeminiOptions = {
  apiKey?: string
  model?: string
  /** Attempts per request; 429 and 5xx responses are retried with backoff. */
  attempts?: number
}

type ResponseBody = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }

/** A VoiceRating backed by the Gemini API. The audio is sent as 16-bit WAV at its own sample rate. */
export function geminiVoice(options: GeminiOptions = {}): VoiceRating {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  const model = options.model ?? geminiSettings().model
  const attempts = options.attempts ?? 4

  return async (samples, sampleRate, signal) => {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set")
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: VOICE_PROMPT }, { inline_data: { mime_type: "audio/wav", data: wav(samples, sampleRate).toString("base64") } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { expressiveness: { type: "INTEGER" } }, required: ["expressiveness"] } },
    })
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(`${API_URL}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
        signal,
      })
      if (response.ok) {
        try {
          return parseRating((await response.json()) as ResponseBody)
        } catch (error) {
          if (attempt >= attempts) throw new Error(`Gemini ${model}: ${(error as Error).message}`, { cause: error })
          continue
        }
      }
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt >= attempts) {
        throw new Error(`Gemini ${model} returned ${response.status}: ${await response.text()}`)
      }
      await sleep(2000 * 2 ** (attempt - 1), undefined, { signal })
    }
  }
}

/** The 1-5 rating in a reply; throws on anything else. */
export function parseRating(data: ResponseBody): number {
  const text = (data.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? "").join("")
  const rating = (JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { expressiveness?: unknown }).expressiveness
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) throw new Error(`invalid rating ${JSON.stringify(rating)}`)
  return rating as number
}

/** Mono 16-bit PCM WAV. */
export function wav(samples: Float32Array, sampleRate: number): Buffer {
  const pcm = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2)
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVEfmt ", 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/** A structured judgment of audio: a prompt, a response schema and 16-bit WAV in, the parsed JSON reply out. */
export type AudioJudgment = (request: { prompt: string; schema: Record<string, unknown>; wav: Uint8Array }) => Promise<unknown>

/** An AudioJudgment backed by the Gemini API. */
export function geminiJudgment(options: GeminiOptions = {}): AudioJudgment {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  const model = options.model ?? geminiSettings().model
  const attempts = options.attempts ?? 4
  return async ({ prompt, schema, wav: audio }) => {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set")
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: "audio/wav", data: Buffer.from(audio).toString("base64") } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    })
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(`${API_URL}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
      })
      if (response.ok) {
        const data = (await response.json()) as ResponseBody
        const text = (data.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? "").join("")
        try {
          return JSON.parse(text)
        } catch (error) {
          if (attempt >= attempts) throw new Error(`Gemini ${model}: ${(error as Error).message}`, { cause: error })
          continue
        }
      }
      if (!(response.status === 429 || response.status >= 500) || attempt >= attempts) {
        throw new Error(`Gemini ${model} returned ${response.status}: ${await response.text()}`)
      }
      await sleep(2000 * 2 ** (attempt - 1))
    }
  }
}
