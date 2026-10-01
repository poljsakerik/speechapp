import assert from "node:assert/strict"
import { test } from "node:test"
import type { MarkedWord } from "./importance.ts"
import { analyzeSpeech } from "./analysis.ts"
import { detectPauses, readPauseBoundaries, type PauseBoundary } from "./pauses.ts"
import { wordGaps } from "./timing.ts"

function speak(text: string, gaps: Record<number, number> = {}, fillers: number[] = []): MarkedWord[] {
  let t = 0
  return text.split(" ").map((text, index) => {
    t += gaps[index - 1] ?? 0
    const start = t
    t += 0.25
    return { text, index, start, end: t, importance: fillers.includes(index) ? "filler" : "unimportant" }
  })
}
const boundary = (after: number, placement: PauseBoundary["placement"], confidence: PauseBoundary["confidence"] = "clear"): PauseBoundary => ({ after, placement, confidence })
const rules = (words: MarkedWord[], boundaries: PauseBoundary[]) => detectPauses(words, boundaries).candidates.map((m) => m.rule)

test("completed processing opportunities need space, not every important word or punctuation mark", () => {
  const words = speak("Revenue doubled. Next we discuss hiring.")
  words[1].importance = "message"
  assert.deepEqual(rules(words, [boundary(1, "processing")]), ["PAUSE_NECESSARY"])
  assert.deepEqual(rules(words, []), [])
  assert.deepEqual(rules(words, [boundary(1, "transition")]), [])
  assert.deepEqual(rules(speak("Revenue doubled. Next we discuss hiring.", { 1: 0.8 }), [boundary(1, "processing")]), [])
})

test("the same gap can help a completed thought and disrupt connected words", () => {
  const words = speak("Very useful. Moving on.", { 0: 0.8, 1: 0.8 })
  const result = detectPauses(words, [boundary(0, "connected"), boundary(1, "processing")])
  assert.deepEqual(result.candidates.map((m) => [m.rule, m.first, m.last, m.at]), [["PAUSE_UNNECESSARY", 0, 1, 0.25]])
})

test("dramatic and uncertain readings allow valid alternative deliveries", () => {
  const words = speak("And the winner is you.", { 3: 4 })
  assert.deepEqual(rules(words, [boundary(3, "flexible")]), [])
  assert.deepEqual(rules(words, [boundary(3, "connected", "tentative")]), [])
  assert.deepEqual(rules(speak("It worked. Next question."), [boundary(1, "processing", "tentative")]), [])
})

test("an excessive sentence gap needs local evidence, with a different baseline for a slow delivery", () => {
  const text = "One. Two. Three. Four. Five. Six."
  assert.deepEqual(rules(speak(text, { 0: 0.5, 1: 0.5, 2: 4, 3: 0.5 }), [boundary(2, "transition")]), ["PAUSE_UNNECESSARY"])
  assert.deepEqual(rules(speak(text, { 0: 1.5, 1: 1.5, 2: 4, 3: 1.5 }), [boundary(2, "transition")]), [])
  assert.deepEqual(rules(speak("First. Second.", { 0: 4 }), [boundary(0, "transition")]), [])
})

test("fillers include repetitions and abandoned starts, but meaningful words survive", () => {
  const words = speak("We we like music so they get only one ticket.", {}, [0, 5, 6])
  const result = detectPauses(words, [])
  assert.deepEqual(result.candidates.map((m) => [m.rule, m.text]), [["PAUSE_FILLERS", "We"], ["PAUSE_FILLERS", "they get"]])
  assert.ok(!result.candidates.some((m) => m.text.includes("like") || m.text.includes("so")))
})

test("fillers are not silence, and overlapping golden rules remain separate candidates", () => {
  const words = speak("I I agree.", { 0: 0.8 }, [0])
  assert.deepEqual(rules(words, [boundary(0, "connected")]), ["PAUSE_FILLERS", "PAUSE_UNNECESSARY"])
  assert.deepEqual(rules(words, [boundary(0, "processing")]), ["PAUSE_FILLERS"])
  const fluentFiller = speak("Yes um agreed.", {}, [1])
  assert.deepEqual(detectPauses(fluentFiller, []).gaps, [])
})

test("never bridge invalid, missing or overlapping word times or infer edge silence", () => {
  const words = speak("first um third last", { 0: 1, 1: 1, 2: 1 }, [1])
  words[1].start = undefined
  words[3].start = words[2].start
  assert.deepEqual(wordGaps(words), [])
  assert.deepEqual(rules(words, [boundary(0, "processing"), boundary(1, "connected"), boundary(2, "connected")]), [])
  assert.deepEqual(detectPauses([], []).marks, [])
  assert.deepEqual(detectPauses([{ ...words[0], start: NaN }], []).marks, [])
})

test("pause judgments validate indexes, chunk ownership, labels and conflicting duplicates", () => {
  const result = readPauseBoundaries({ pauseBoundaries: [
    boundary(-1, "connected"), boundary(0, "connected"), boundary(1, "processing"),
    boundary(1, "connected"), boundary(2, "flexible"), boundary(3, "processing"),
    { after: 1.5, placement: "connected", confidence: "clear" }, null,
    { after: 2, placement: "invented", confidence: "clear" },
  ] }, 1, 2, 3)
  assert.deepEqual(result, [boundary(1, "flexible", "tentative")])
  assert.throws(() => readPauseBoundaries({}, 0, 2, 3), /no pauseBoundaries/)
})

test("live pipeline shares one labeling request across rate, fillers and pause context", async () => {
  const requests: string[] = []
  const result = await analyzeSpeech(speak("Um costs doubled. Now act.", {}, [0]), async ({ schemaName, user }) => {
    requests.push(schemaName)
    if (schemaName === "message") return { message: "Act now.", points: ["Costs doubled."] }
    assert.match(user, /Observed-gap boundaries/)
    return { phrases: [{ first: 0, last: 0, importance: "filler" }, { first: 1, last: 4, importance: "message" }], pauseBoundaries: [boundary(2, "processing")] }
  })
  assert.deepEqual(requests, ["message", "phrases_and_pauses"])
  assert.deepEqual(result.pauses.candidates.map((m) => m.rule), ["PAUSE_FILLERS", "PAUSE_NECESSARY"])
  assert.ok(result.rate)
})
