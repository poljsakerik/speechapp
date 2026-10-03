import { isValidationMessage } from "@micmane/validation/messages";
import { initTRPC } from "@trpc/server";

import type { Context } from "./context.ts";

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const issues = (
      error.cause as { issues?: { message?: unknown }[] } | undefined
    )?.issues;
    const issueMessage = Array.isArray(issues) ? issues[0]?.message : undefined;
    const validationMessage = isValidationMessage(error.message)
      ? error.message
      : typeof issueMessage === "string" && isValidationMessage(issueMessage)
        ? issueMessage
        : undefined;
    // Validation errors and upstream exception text are diagnostic, never UI copy.
    return {
      ...shape,
      message: validationMessage ?? shape.data.code,
      data: { ...shape.data, stack: undefined },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
