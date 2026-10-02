import { TRPCError } from "@trpc/server";
import * as v from "valibot";

import { publicProcedure, router } from "../trpc.ts";

const allowed = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "video/mp4",
]);
export const maxBytes = 25 * 1024 * 1024;

export const reviewRouter = router({
  create: publicProcedure
    .input(v.instance(FormData, "A multipart audio file is required"))
    .mutation(async ({ input, ctx }) => {
      const upload = input.get("file");
      if (!(upload instanceof File))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A file is required",
        });
      if (!allowed.has(upload.type))
        throw new TRPCError({
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Unsupported audio format",
        });
      if (upload.size > maxBytes)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Recording exceeds 25 MB",
        });
      if (!upload.size)
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Empty recording",
        });
      let result;
      try {
        result = await ctx.review(Buffer.from(await upload.arrayBuffer()));
      } catch (error) {
        ctx.req.log.error(error);
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Review service unavailable",
          cause: error,
        });
      }
      if (!result)
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Not enough speech",
        });
      return result;
    }),
});
