import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 py-1 text-base text-ink shadow-[inset_0_1px_1px_oklch(0.2_0.01_55/0.05)] transition-[border-color,box-shadow] duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-glass-ink focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--glass)_22%,transparent)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_16%,transparent)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
