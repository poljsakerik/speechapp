import type { FastifyReply, FastifyRequest } from "fastify";

import type { Demo } from "../demo.ts";
import type { reviewAudio } from "../review.ts";

export type Services = { review: typeof reviewAudio; demo?: Demo };

export function createContextFactory(services: Services) {
  return ({ req, res }: { req: FastifyRequest; res: FastifyReply }) => ({
    req,
    res,
    ...services,
  });
}

export type Context = ReturnType<ReturnType<typeof createContextFactory>>;
