import assert from "node:assert/strict"
import { test } from "node:test"
import { limiter } from "./limit.ts"

test("a limiter runs at most its size at once, and every call finishes", async () => {
  const limit = limiter(2)
  let active = 0, peak = 0
  const results = await Promise.all(Array.from({ length: 7 }, (_, i) => limit(async () => {
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return i
  })))
  assert.equal(peak, 2)
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6])
})

test("a failed call frees its place", async () => {
  const limit = limiter(1)
  await assert.rejects(limit(async () => { throw new Error("no") }))
  assert.equal(await limit(async () => "next"), "next")
})
