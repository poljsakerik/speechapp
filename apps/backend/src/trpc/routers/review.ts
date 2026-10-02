import {
  recordingSchema,
  reviewUploadSchema,
} from "@micmane/validation/review";
import { TRPCError } from "@trpc/server";
import * as v from "valibot";

import { publicProcedure, router } from "../trpc.ts";

const issueCodes: Record<string, TRPCError["code"]> = {
  mime_type: "UNSUPPORTED_MEDIA_TYPE",
  min_size: "UNPROCESSABLE_CONTENT",
  max_size: "PAYLOAD_TOO_LARGE",
};

export const reviewRouter = router({
  create: publicProcedure
    .input(reviewUploadSchema)
    .mutation(async ({ input, ctx }) => {
      const recording = v.safeParse(recordingSchema, input, {
        abortPipeEarly: true,
      });
      if (!recording.success) {
        const [issue] = recording.issues;
        throw new TRPCError({
          code: issueCodes[issue.type] ?? "BAD_REQUEST",
          message: issue.message,
        });
      }
      const upload = recording.output;
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
