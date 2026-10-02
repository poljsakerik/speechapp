import { setTimeout as sleep } from "node:timers/promises"
import { limiter } from "./limit.ts"
import type { JsonCompletion } from "./types.ts"

const API_URL = "https://api.openai.com/v1/responses"
/** Requests in flight at once, across every feature and review in the process. */
const gate = limiter(Number(process.env.OPENAI_CONCURRENCY ?? 16))

export type ReasoningEffort = "none" | "low" | "medium" | "high"

/** One model configuration for live reviews, the CLI and evaluation cache keys. */
export function rateModelSettings(env: NodeJS.ProcessEnv = process.env): { model: string; effort: ReasoningEffort } {
  const effort = env.RATE_EFFORT ?? "low"
  if (!["none", "low", "medium", "high"].includes(effort)) throw new Error(`Invalid RATE_EFFORT: ${effort}`)
  return { model: env.RATE_MODEL ?? "gpt-6-sol", effort: effort as ReasoningEffort }
}

/** The text model that lists the feelings each tonality passage could carry. */
export function tonalitySettings(env: NodeJS.ProcessEnv = process.env): { model: string; effort: ReasoningEffort } {
  const effort = env.TONALITY_EFFORT ?? "low"
  if (!["none", "low", "medium", "high"].includes(effort)) throw new Error(`Invalid TONALITY_EFFORT: ${effort}`)
  return { model: env.TONALITY_MODEL ?? "gpt-6-sol", effort: effort as ReasoningEffort }
}

export type OpenAIOptions = {
  apiKey?: string
  model?: string
  effort?: ReasoningEffort
  /** Attempts per request; 429 and 5xx responses are retried with backoff. */
  attempts?: number
}

type ResponseBody = {
  status: string
  incomplete_details?: { reason: string } | null
  output: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[]
}

/** A JsonCompletion backed by the OpenAI Responses API with strict JSON schema output. */
export function openaiCompletion(options: OpenAIOptions = {}): JsonCompletion {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
  const settings = rateModelSettings()
  const model = options.model ?? settings.model
  const effort = options.effort ?? settings.effort
  const attempts = options.attempts ?? 4

  return async ({ system, user, schema, schemaName, cacheKey }, signal) => {
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")
    const body = JSON.stringify({
      model,
      instructions: system,
      input: user,
      reasoning: { effort },
      text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
      store: false,
      ...(cacheKey ? { prompt_cache_key: cacheKey } : {}),
    })
    for (let attempt = 1; ; attempt++) {
      const response = await gate(() => fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal,
      }))
      if (response.ok) {
        try {
          return parseOutput((await response.json()) as ResponseBody, model)
        } catch (error) {
          // Strict mode still occasionally yields malformed JSON; ask again.
          if (!(error instanceof SyntaxError) || attempt >= attempts) throw error
          continue
        }
      }
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt >= attempts) {
        throw new Error(`OpenAI ${model} returned ${response.status}: ${await response.text()}`)
      }
      await sleep(1000 * 2 ** (attempt - 1), undefined, { signal })
    }
  }
}

function parseOutput(data: ResponseBody, model: string): unknown {
  if (data.status !== "completed") {
    throw new Error(`OpenAI ${model} response ${data.status}: ${data.incomplete_details?.reason ?? "unknown"}`)
  }
  for (const item of data.output) {
    for (const part of item.content ?? []) {
      if (part.type === "refusal") throw new Error(`OpenAI ${model} refused: ${part.refusal}`)
      if (part.type === "output_text" && part.text) return parseLeadingJson(part.text)
    }
  }
  throw new Error(`OpenAI ${model} response has no output text`)
}

/**
 * Parse the JSON object at the start of `text`. With reasoning off, models
 * sometimes append stray text after a complete object; that tail is ignored.
 */
export function parseLeadingJson(text: string): unknown {
  const start = text.indexOf("{")
  let depth = 0
  let inString = false
  for (let i = Math.max(start, 0); i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === "\\") i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1))
  }
  return JSON.parse(text)
}
