import { dictionary } from "cmu-pronouncing-dictionary"
import { numberWords } from "./align.ts"

/** Dictionary syllables, with explicit number expansion and a fallback for unknown words. English only. */
export function syllables(text: string): number {
  return pronunciation(text).syllables
}
export function pronunciation(text: string): { syllables: number; known: boolean } {
  const parts = text.toLowerCase().replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1").replace(/\d+(?:\.\d+)?/g, numberWords).replace(/%/g, " percent").replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)*/g) ?? []
  let n = 0, known = true
  for (const word of parts) {
    const phones = dictionary[word]
    if (phones) n += phones.match(/[012]/g)?.length ?? 1
    else {
      known = false
      let count = word.match(/[aeiouy]+/g)?.length ?? 0
      if (count > 1 && /[^aeiouyl]e$/.test(word)) count--
      n += Math.max(1, count)
    }
  }
  return { syllables: n, known: known && parts.length > 0 }
}
