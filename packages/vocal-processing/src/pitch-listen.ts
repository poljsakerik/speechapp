/**
 * Pitch problems as a listener hears them, from an audio model (gemini.ts).
 *
 * The model hears what pitch measurements can't: a voice that sounds pushed
 * high or low for this speaker, and short flat stretches. But on everyday
 * speech it also calls emphasis "too low" and good delivery "monotone", so
 * its stretches are only candidates: detectPitch keeps a stretch when it is
 * badly distracting (severity 1-2) and the measured pitch agrees.
 *
 * Long audio is sent in chunks of about 30 s, cut between words: given a
 * whole talk, the model returns no stretches at all.
 */
import { wav, type AudioJudgment } from "./gemini.ts"
import type { Word } from "./types.ts"

export type PitchIssue = "too_high" | "too_low" | "monotone" | "sing_song"
/** A stretch the model heard as a problem, in seconds from the start of the recording. Severity 1 is worst. */
export type Heard = { start: number; end: number; issue: PitchIssue; severity: number; how: string; fix: string }
export const LISTEN_VERSION = 1

export const LISTEN_PROMPT = `You are a voice coach listening only to the PITCH of this speaker's voice: how high or low it sits and how it moves. Ignore what the words mean, the recording quality, speed and volume.
List every stretch where the pitch is a problem for the listener. Moving the pitch on purpose, such as dropping or lifting it on a word that matters, is good delivery and not a problem.
For each stretch give:
- start and end in seconds from the start of the clip,
- issue: "too_high" (strained, squeaky, falsetto or unnaturally high for this voice), "too_low" (pressed down, gravelly or unnaturally low for this voice), "monotone" (stuck on one note) or "sing_song" (a repeated, predictable melody),
- severity: 1 = badly distracting, any listener notices it at once and it pulls attention from the message; 2 = clearly distracting; 3 = noticeable but minor; 4 = barely noticeable; 5 = not a problem,
- how: one short sentence on exactly what the voice does wrong,
- fix: one short instruction the speaker can try.
Return an empty list if nothing is a problem.`
const ISSUES: PitchIssue[] = ["too_high", "too_low", "monotone", "sing_song"]
export const LISTEN_SCHEMA = { type: "OBJECT", properties: { problems: { type: "ARRAY", items: { type: "OBJECT", properties: {
  start: { type: "NUMBER" }, end: { type: "NUMBER" }, issue: { type: "STRING", enum: ISSUES },
  severity: { type: "INTEGER" }, how: { type: "STRING" }, fix: { type: "STRING" },
}, required: ["start", "end", "issue", "severity", "how", "fix"] } } }, required: ["problems"] }

/** Ask the model about each chunk, `concurrency` at a time; any failed chunk fails the whole listen. */
export async function listenForPitch(samples: Float32Array, sampleRate: number, words: Word[], judge: AudioJudgment, { chunkSeconds = 30, concurrency = 4 } = {}): Promise<Heard[]> {
  const chunks = chunkTimes(words, samples.length / sampleRate, chunkSeconds)
  const heard: Heard[][] = []
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let k = next++; k < chunks.length; k = next++) {
      const [from, to] = chunks[k]
      const audio = wav(samples.subarray(Math.round(from * sampleRate), Math.round(to * sampleRate)), sampleRate)
      heard[k] = parseHeard(await judge({ prompt: LISTEN_PROMPT, schema: LISTEN_SCHEMA, wav: audio }), to - from)
        .map(h => ({ ...h, start: h.start + from, end: h.end + from }))
    }
  }))
  return heard.flat()
}

/** [start, end) of chunks cut halfway between the two words around each point `seconds` after the last cut. */
export function chunkTimes(words: Word[], duration: number, seconds: number): [number, number][] {
  const cuts = [0]
  for (let i = 1; i < words.length; i++) {
    const before = words[i - 1].end, start = words[i].start
    if (before !== undefined && start !== undefined && start - cuts.at(-1)! >= seconds) cuts.push((before + start) / 2)
  }
  return [...cuts, duration].slice(1).map((end, k) => [cuts[k], end] as [number, number]).filter(([a, b]) => b > a)
}

/** The problems in a reply; malformed ones are dropped, and stretches are clamped to the chunk. */
export function parseHeard(reply: unknown, duration: number): Heard[] {
  const problems = (reply as { problems?: unknown })?.problems
  if (!Array.isArray(problems)) throw new Error("Pitch listening reply has no problems list")
  return problems.flatMap((p: Partial<Heard>) => {
    const start = Math.max(0, Number(p.start)), end = Math.min(duration, Number(p.end))
    return end > start && ISSUES.includes(p.issue!) && Number.isInteger(p.severity) && typeof p.how === "string" && typeof p.fix === "string"
      ? [{ start, end, issue: p.issue!, severity: p.severity!, how: p.how.trim(), fix: p.fix.trim() }] : []
  })
}

