import { TRPCError } from "@trpc/server";
import * as v from "valibot";

import { publicProcedure, router } from "../trpc.ts";

const audioTypes = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "video/mp4",
] as const;
export const maxBytes = 25 * 1024 * 1024;
/** The whole request body: the recording plus room for multipart framing. */
export const maxBodyBytes = maxBytes + 64 * 1024;

const uploadSchema = v.pipe(
  v.instance(FormData, "A multipart audio file is required"),
  v.check(
    (form) => [...form.keys()].length === 1,
    "Send the recording as the only field",
  ),
  v.transform((form) => form.get("file")),
  v.instance(File, "A file is required"),
);

const recordingSchema = v.pipe(
  v.file(),
  // Recorders label takes with codec parameters, e.g. "audio/webm;codecs=opus".
  v.transform(
    (file) =>
      new File([file], file.name, {
        type: file.type.split(";")[0].trim().toLowerCase(),
      }),
  ),
  v.mimeType(audioTypes, "Unsupported audio format"),
  v.minSize(1, "Empty recording"),
  v.maxSize(maxBytes, "Recording exceeds 25 MB"),
);

const issueCodes: Record<string, TRPCError["code"]> = {
  mime_type: "UNSUPPORTED_MEDIA_TYPE",
  min_size: "UNPROCESSABLE_CONTENT",
  max_size: "PAYLOAD_TOO_LARGE",
};

export const reviewRouter = router({
  create: publicProcedure
    .input(uploadSchema)
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
