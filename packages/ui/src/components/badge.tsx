import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@micmane/ui/lib/utils"
import { Slot } from "radix-ui"

// Badges are tags stamped on the editor: small, square-shouldered, never pills.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border px-1.5 text-[0.6875rem] leading-none font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-primary-foreground",
        secondary: "border-transparent bg-sunken text-ink-2",
        outline: "border-line-strong bg-surface text-ink-2",
        // Sample content is always labeled as such.
        sample: "border-dashed border-line-strong bg-surface text-ink-3",
        live: "border-transparent glass-lit text-[oklch(0.19_0.008_55)]",
        destructive: "border-transparent bg-[color-mix(in_oklch,var(--destructive),white_88%)] text-destructive",
        // Foundations: pastel field, deep ink text.
        rate: "border-transparent bg-f-rate text-f-rate-ink",
        volume: "border-transparent bg-f-volume text-f-volume-ink",
        pitch_melody: "border-transparent bg-f-pitch text-f-pitch-ink",
        tonality: "border-transparent bg-f-tonality text-f-tonality-ink",
        pauses: "border-transparent bg-f-pauses text-f-pauses-ink",
        ghost: "border-transparent text-ink-3",
        link: "border-transparent px-0 text-ink underline underline-offset-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
