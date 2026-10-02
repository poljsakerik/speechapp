import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";

import { reviewAudio } from "./review.ts";
import { createContextFactory } from "./trpc/context.ts";
import { appRouter, type AppRouter } from "./trpc/routers/_app.ts";
import { maxBytes } from "./trpc/routers/review.ts";

export function buildApp(review = reviewAudio) {
  const app = Fastify({
    logger: true,
    routerOptions: { maxParamLength: 5000 },
  });

  // tRPC streams multipart bodies without a size limit, so refuse oversized uploads before they are read.
  app.addHook("onRequest", async (request, reply) => {
    if (Number(request.headers["content-length"]) > maxBytes + 1024 * 1024) {
      return reply.code(413).send({ error: "Recording exceeds 25 MB" });
    }
  });

  app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: createContextFactory({ review }),
      onError({ path, error }) {
        if (error.code === "INTERNAL_SERVER_ERROR")
          app.log.error({ path, error }, "tRPC handler failed");
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  return app;
}
