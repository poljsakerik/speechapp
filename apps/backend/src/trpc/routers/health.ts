import { publicProcedure, router } from "../trpc.ts";

export const healthRouter = router({
  // `demo` says whether a passage can be voiced, so the app can leave the control out.
  get: publicProcedure.query(({ ctx }) => ({ ok: true, demo: !!ctx.demo })),
});
