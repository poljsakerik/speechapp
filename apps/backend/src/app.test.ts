import assert from "node:assert/strict"
import { test } from "node:test"
import { buildApp } from "./app.ts"

test("health and upload contract", async (context) => {
  let received: Buffer | undefined
  const app = buildApp(async (audio) => {
    received = audio
    return { segments: [], rateDiagnostics: { version: 9, status: "reviewed" as const, pace: undefined, articulationRate: undefined, pacing: undefined, marks: [] }, pauseDiagnostics: { version: 1, status: "reviewed" as const, review: undefined, pauses: [], marks: [] }, volumeDiagnostics: { version: 1, status: "reviewed" as const, marks: [] }, tonalityDiagnostics: { version: 3, status: "reviewed" as const, passages: undefined, marks: [] }, pitchDiagnostics: { version: 1, status: "reviewed" as const, marks: [], spread: undefined, heard: undefined }, timings: {}, review: { overall: "test", assessments: [] } }
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
  assert.equal(review.json().audio, undefined, "the browser already has the recording")
  assert.equal(review.json().rateDiagnostics.status, "reviewed")
  assert.deepEqual(received, Buffer.from("abc"))
})
