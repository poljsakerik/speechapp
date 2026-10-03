/** Transcript words retain recognizer or aligned timing when available. */
export type Word = { text: string; start?: number; end?: number };

/** A structured completion: a system and user prompt in, JSON matching `schema` out. */
export type JsonCompletion = (
  request: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
    schemaName: string;
    /** Requests that start with the same long prompt share a key, so the provider can reuse its cached prefix. */
    cacheKey?: string;
  },
  signal?: AbortSignal,
) => Promise<unknown>;
