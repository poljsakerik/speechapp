/**
 * Run at most `size` calls at once; the rest wait their turn. One limit per
 * API is shared by every review in the process, so features that call the
 * same API at the same time, and concurrent reviews, can't exceed it together.
 */
export function limiter(size: number) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`Invalid concurrency limit: ${size}`)
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(run: () => Promise<T>): Promise<T> => {
    while (active >= size) await new Promise<void>(resolve => waiting.push(resolve))
    active++
    try {
      return await run()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}
