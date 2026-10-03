import { router } from "../trpc.ts";
import { demoRouter } from "./demo.ts";
import { healthRouter } from "./health.ts";
import { reviewRouter } from "./review.ts";

export const appRouter = router({
  demo: demoRouter,
  health: healthRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;
