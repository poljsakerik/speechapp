import Fastify from "fastify"
import multipart from "@fastify/multipart"
import { reviewAudio } from "./review.ts"

const allowed = new Set(["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/webm", "video/mp4"])
const maxBytes = 25 * 1024 * 1024

export function buildApp(review = reviewAudio) {
  const app = Fastify({ logger: true })
  app.register(multipart, { limits: { fileSize: maxBytes, files: 1 } })
  app.get("/api/health", async () => ({ ok: true }))
  app.post("/api/review", async (request, reply) => {
    let upload
    try {
      if (!request.isMultipart()) return reply.code(400).send({ error: "A multipart audio file is required" })
      upload = await request.file()
      if (!upload) return reply.code(400).send({ error: "A file is required" })
      if (!allowed.has(upload.mimetype)) return reply.code(415).send({ error: "Unsupported audio format" })
      const audio = await upload.toBuffer()
      if (!audio.length) return reply.code(422).send({ error: "Empty recording" })
      const result = await review(audio)
      if (!result) return reply.code(422).send({ error: "Not enough speech" })
      return result
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError) return reply.code(413).send({ error: "Recording exceeds 25 MB" })
      request.log.error(error)
      return reply.code(502).send({ error: "Review service unavailable" })
    }
  })
  return app
}
