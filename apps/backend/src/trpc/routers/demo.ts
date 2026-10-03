import { demoUploadSchema } from "@micmane/validation/demo";
import { TRPCError } from "@trpc/server";

import { publicProcedure, router } from "../trpc.ts";

export const demoRouter = router({
  /** The passage said the way its note asks, in the speaker's voice, as base64 MP3. */
  create: publicProcedure
    .input(demoUploadSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.demo)
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Voice demos are not set up",
        });
      try {
        const audio = await ctx.demo({
          reference: new Uint8Array(await input.reference.arrayBuffer()),
          referenceText: input.referenceText,
          passage: input.passage,
        });
        return {
          audio: Buffer.from(audio).toString("base64"),
          mimeType: "audio/mpeg",
        };
      } catch (error) {
        ctx.req.log.error(error);
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Voice demo service unavailable",
          cause: error,
        });
      }
    }),
});
