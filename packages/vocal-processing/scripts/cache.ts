/** A disk cache for model replies, keyed by the full request, model settings and pacing version. */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { openaiCompletion, rateModelSettings } from "../src/openai.ts"
import { PACING_VERSION } from "../src/pacing.ts"
import type { JsonCompletion } from "../src/types.ts"

export function cachedCompletion(dir: string, run = "default"): JsonCompletion {
  const { model, effort } = rateModelSettings()
  const complete = openaiCompletion({ model, effort })
  return async request => {
    const file = join(dir, `pacing-${createHash("sha256").update(JSON.stringify({ request, model, effort, version: PACING_VERSION, run })).digest("hex")}.json`)
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
    const reply = await complete(request)
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(reply) + "\n")
    return reply
  }
}
