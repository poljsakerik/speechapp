import { publicProcedure, router } from "../trpc.ts";

export const healthRouter = router({
  get: publicProcedure.query(() => ({ ok: true })),
});
