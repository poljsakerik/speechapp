import { router } from "../trpc.ts";
import { healthRouter } from "./health.ts";
import { reviewRouter } from "./review.ts";

export const appRouter = router({
  health: healthRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;
