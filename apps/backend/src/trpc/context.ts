import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

import type { reviewAudio } from "../review.ts";

export type Services = { review: typeof reviewAudio };

export function createContextFactory(services: Services) {
  return ({ req, res }: CreateFastifyContextOptions) => ({
    req,
    res,
    ...services,
  });
}

export type Context = ReturnType<ReturnType<typeof createContextFactory>>;
