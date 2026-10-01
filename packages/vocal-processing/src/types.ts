/** Transcript words retain recognizer or aligned timing when available. */
export type Word = { text: string; start?: number; end?: number }

/** Structured completion contract used by text-based pacing prediction. */
export type JsonCompletion = (request: {
  system: string
  user: string
  schema: Record<string, unknown>
  schemaName: string
}) => Promise<unknown>
