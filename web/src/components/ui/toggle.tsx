import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Toggle as TogglePrimitive } from "radix-ui"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap text-ink-3 transition-[background-color,color,border-color,box-shadow] duration-200 ease-(--ease-out) outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-glass focus-visible:ring-offset-1 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-45 data-[state=on]:text-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent hover:bg-sunken data-[state=on]:bg-surface data-[state=on]:shadow-[0_0_0_1px_var(--line-strong),0_1px_2px_oklch(0.2_0.01_55/0.08)]",
        outline: "border border-line bg-surface hover:border-line-strong data-[state=on]:border-ink",
        // A foundation layer switch: the swatch carries the color, the label stays ink.
        layer: "justify-start rounded-sm px-2! text-left text-ink-3 hover:bg-sunken data-[state=on]:text-ink [&_[data-swatch]]:opacity-30 data-[state=on]:[&_[data-swatch]]:opacity-100",
      },
      size: {
        default: "h-9 min-w-9 px-3",
        sm: "h-8 min-w-8 px-2.5 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 min-w-10 px-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
