import type { Word } from "./importance.ts"

type DeepgramWord = { word: string; punctuated_word?: string; start: number; end: number }

/** Words from a Deepgram pre-recorded transcription response. */
export function wordsFromDeepgram(response: unknown): Word[] {
  const data = response as { results: { channels: { alternatives: { words: DeepgramWord[] }[] }[] } }
  return data.results.channels[0].alternatives[0].words.map((w) => ({
    text: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
  }))
}

/**
 * Transcribe an audio file with Deepgram nova-3. Filler words are kept so the
 * importance stage can label them and the rate stage can leave them out.
 */
export async function transcribe(audio: Uint8Array<ArrayBuffer>, apiKey = process.env.DEEPGRAM_API_KEY): Promise<unknown> {
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set")
  const params = new URLSearchParams({ model: "nova-3", smart_format: "true", punctuate: "true", filler_words: "true" })
  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/octet-stream" },
    body: audio,
  })
  if (!response.ok) throw new Error(`Deepgram returned ${response.status}: ${await response.text()}`)
  return response.json()
}
