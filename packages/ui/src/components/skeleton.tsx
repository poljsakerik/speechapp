import { cn } from "@micmane/ui/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-[color-mix(in_oklch,var(--sunken),var(--ink)_4%)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
