/** Disk caches for model replies, keyed by the full request, model settings and prompt version. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  geminiJudgment,
  geminiSettings,
  type AudioJudgment,
} from "../src/gemini.ts";
import { openaiCompletion, rateModelSettings } from "../src/openai.ts";
import { PACING_VERSION } from "../src/pacing.ts";
import { LISTEN_VERSION } from "../src/pitch-listen.ts";
import type { JsonCompletion } from "../src/types.ts";

export function cachedCompletion(dir: string, run = "default"): JsonCompletion {
  const { model, effort } = rateModelSettings();
  const complete = openaiCompletion({ model, effort });
  return async (request) => {
    const file = join(
      dir,
      `pacing-${createHash("sha256")
        .update(
          JSON.stringify({
            request,
            model,
            effort,
            version: PACING_VERSION,
            run,
          }),
        )
        .digest("hex")}.json`,
    );
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    const reply = await complete(request);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(reply) + "\n");
    return reply;
  };
}

export function cachedJudgment(dir: string, run = "default"): AudioJudgment {
  const { model } = geminiSettings(),
    judge = geminiJudgment({ model });
  return async (request) => {
    const file = join(
      dir,
      `listen-${createHash("sha256")
        .update(
          JSON.stringify({
            prompt: request.prompt,
            schema: request.schema,
            wav: createHash("sha256").update(request.wav).digest("hex"),
            model,
            version: LISTEN_VERSION,
            run,
          }),
        )
        .digest("hex")}.json`,
    );
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    const reply = await judge(request);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(reply) + "\n");
    return reply;
  };
}
