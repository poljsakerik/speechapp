import { markMessage, type JsonCompletion, type Word } from "./importance.ts"
import { detectRate } from "./rate.ts"
import { detectPauses } from "./pauses.ts"

/** One transcription and one shared meaning-labeling pass for both foundations. */
export async function analyzeSpeech(words: Word[], complete: JsonCompletion) {
  const labeled = await markMessage(words, { complete, analyzePauses: true })
  return { labeled, rate: detectRate(labeled.words), pauses: detectPauses(labeled.words, labeled.pauseBoundaries ?? []) }
}
