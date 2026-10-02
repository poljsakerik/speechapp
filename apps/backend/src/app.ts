import { maxRecordingBytes } from "@micmane/validation/review";
import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import Fastify from "fastify";

import { reviewAudio } from "./review.ts";
import { createContextFactory } from "./trpc/context.ts";
import { appRouter } from "./trpc/routers/_app.ts";

/** The whole request body: the recording plus room for multipart framing. */
const maxBodyBytes = maxRecordingBytes + 64 * 1024;

export function buildApp(review = reviewAudio) {
  const app = Fastify({
    logger: true,
    routerOptions: { maxParamLength: 5000 },
  });
  const createContext = createContextFactory({ review });

  // tRPC's Fastify plugin reads bodies without a size limit, so requests go
  // through its node-http handler, which stops reading at maxBodyBytes whether
  // or not the request declares a Content-Length.
  app.register(async (trpc) => {
    // Leave the body on the socket for tRPC to read.
    trpc.removeAllContentTypeParsers();
    trpc.addContentTypeParser("*", (_request, _payload, done) => done(null));

    trpc.all<{ Params: { path: string } }>(
      "/trpc/:path",
      async (request, reply) => {
        reply.hijack();
        await nodeHTTPRequestHandler({
          router: appRouter,
          req: request.raw,
          res: reply.raw,
          path: request.params.path,
          maxBodySize: maxBodyBytes,
          createContext: () => createContext({ req: request, res: reply }),
          onError({ path, error }) {
            if (error.code === "INTERNAL_SERVER_ERROR")
              request.log.error({ path, error }, "tRPC handler failed");
          },
        });
      },
    );
  });

  return app;
}
