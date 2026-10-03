import type { FastifyReply, FastifyRequest } from "fastify";

import type { reviewAudio } from "../review.ts";

export type Services = { review: typeof reviewAudio };

export function createContextFactory(services: Services) {
  return ({ req, res }: { req: FastifyRequest; res: FastifyReply }) => ({
    req,
    res,
    ...services,
  });
}

export type Context = ReturnType<ReturnType<typeof createContextFactory>>;
