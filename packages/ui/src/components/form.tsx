import { cn } from "@micmane/ui/lib/utils";
import type { ComponentProps } from "react";

/** Validation schemas return keys. The caller supplies its namespace-aware t,
 * just like Leksoro's FormMessage; this UI package owns no translation catalog. */
export function FormMessage<Key extends string>({
  message,
  t,
  className,
  children,
  ...props
}: Omit<ComponentProps<"span">, "translate"> & {
  message?: Key;
  t: (key: Key) => string;
}) {
  const body = message ? t(message) : children;
  if (!body) return null;
  return (
    <span
      data-slot="form-message"
      className={cn("text-sm", className)}
      {...props}
    >
      {body}
    </span>
  );
}
