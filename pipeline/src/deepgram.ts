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
