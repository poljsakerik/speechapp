import assert from "node:assert/strict"
import { test } from "node:test"
import { buildApp } from "./app.ts"

test("health and upload contract", async (context) => {
  let received: { audio: Buffer; type: string } | undefined
  const app = buildApp(async (audio, type) => {
    received = { audio, type }
    return { audio: audio.toString("base64"), audioType: type, segments: [], rateDiagnostics: { version: 9, status: "reviewed" as const, pace: undefined, articulationRate: undefined, pacing: undefined, marks: [] }, review: { overall: "test", assessments: [] } }
  })
  context.after(() => app.close())
  await app.ready()

  const health = await app.inject({ method: "GET", url: "/api/health" })
  assert.equal(health.statusCode, 200)
  assert.deepEqual(health.json(), { ok: true })

  const missing = await app.inject({ method: "POST", url: "/api/review" })
  assert.equal(missing.statusCode, 400)

  const boundary = "micmane-boundary"
  const payload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="take.mp3"\r\nContent-Type: audio/mpeg\r\n\r\nabc\r\n--${boundary}--\r\n`)
  const review = await app.inject({ method: "POST", url: "/api/review", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload })
  assert.equal(review.statusCode, 200)
  assert.equal(review.json().audioType, "audio/mpeg")
  assert.equal(review.json().audio, Buffer.from("abc").toString("base64"))
  assert.equal(review.json().rateDiagnostics.status, "reviewed")
  assert.deepEqual(received, { audio: Buffer.from("abc"), type: "audio/mpeg" })
})
