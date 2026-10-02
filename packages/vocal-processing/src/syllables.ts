import { dictionary } from "cmu-pronouncing-dictionary";
import { numberWords } from "./align.ts";

/** Dictionary syllables, with explicit number expansion and a fallback for unknown words. English only. */
export function syllables(text: string): number {
  return pronunciation(text).syllables;
}
/**
 * Syllables and phones (speech sounds) of a transcript word. Phones measure
 * how much there is to say more finely than syllables: "strengths" and "a"
 * are one syllable each.
 */
export function pronunciation(text: string): {
  syllables: number;
  phones: number;
  known: boolean;
} {
  const parts =
    text
      .toLowerCase()
      .replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1")
      .replace(/\d+(?:\.\d+)?/g, numberWords)
      .replace(/%/g, " percent")
      .replace(/[’‘]/g, "'")
      .match(/[a-z]+(?:'[a-z]+)*/g) ?? [];
  let n = 0,
    sounds = 0,
    known = true;
  for (const word of parts) {
    const phones = dictionary[word];
    if (phones) {
      n += phones.match(/[012]/g)?.length ?? 1;
      sounds += phones.split(" ").length;
    } else {
      known = false;
      let count = word.match(/[aeiouy]+/g)?.length ?? 0;
      if (count > 1 && /[^aeiouyl]e$/.test(word)) count--;
      n += Math.max(1, count);
      sounds += Math.max(1, Math.round(word.length * 0.8));
    }
  }
  return { syllables: n, phones: sounds, known: known && parts.length > 0 };
}
