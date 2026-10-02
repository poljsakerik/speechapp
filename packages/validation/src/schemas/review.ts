import * as v from "valibot";

export const audioTypes = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "video/mp4",
] as const;

export const maxRecordingBytes = 25 * 1024 * 1024;

/** The `review.create` form: the recording as its only field. */
export const reviewUploadSchema = v.pipe(
  v.instance(FormData, "A multipart audio file is required"),
  v.check(
    (form) => [...form.keys()].length === 1,
    "Send the recording as the only field",
  ),
  v.transform((form) => form.get("file")),
  v.instance(File, "A file is required"),
);

/**
 * A recording the coach can review, with its type reduced to the bare MIME
 * type. Parse with `abortPipeEarly` so the first issue names the problem.
 */
export const recordingSchema = v.pipe(
  v.blob(),
  // Recorders label takes with codec parameters, e.g. "audio/webm;codecs=opus".
  v.transform(
    (blob) =>
      new Blob([blob], { type: blob.type.split(";")[0].trim().toLowerCase() }),
  ),
  v.mimeType(audioTypes, "Unsupported audio format"),
  v.minSize(1, "Empty recording"),
  v.maxSize(maxRecordingBytes, "Recording exceeds 25 MB"),
);
