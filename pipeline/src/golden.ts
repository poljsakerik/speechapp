import type { Word } from "./importance.ts"

/** A mark from the golden-set annotator; indexes are characters of the .txt transcript. */
export type GoldenMark = { startAt: number; endAt: number; startIndex: number; endIndex: number; foundationType: string; rule: string }

/** Character [start, end) of each word in the transcript text, or undefined where a word isn't found. */
export function wordOffsets(text: string, words: Word[]): ([number, number] | undefined)[] {
  let cursor = 0
  return words.map((w) => {
    const start = text.indexOf(w.text, cursor)
    if (start < 0) return undefined
    cursor = start + w.text.length
    return [start, cursor]
  })
}

/** For each mark, the indexes of the words it covers. */
export function alignMarks(text: string, words: Word[], marks: GoldenMark[]): number[][] {
  const offsets = wordOffsets(text, words)
  return marks.map((m) =>
    offsets.flatMap((o, i) => (o && o[0] < m.endIndex && o[1] > m.startIndex ? [i] : [])),
  )
}
