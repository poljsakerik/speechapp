import { cn } from "@micmane/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-md border border-transparent font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-(--ease-out) outline-none select-none focus-visible:ring-2 focus-visible:ring-glass focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-busy:pointer-events-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Ink: the primary action on white chrome.
        default:
          "bg-ink text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(0.2_0.01_55/0.3)] hover:bg-[color-mix(in_oklch,var(--ink),var(--graphite)_45%)]",
        // Hairline on white.
        outline:
          "border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-sunken aria-expanded:bg-sunken",
        secondary:
          "bg-sunken text-ink hover:bg-[color-mix(in_oklch,var(--sunken),var(--ink)_6%)]",
        ghost:
          "text-ink-2 hover:bg-sunken hover:text-ink aria-expanded:bg-sunken aria-expanded:text-ink",
        // Orange glass: reserved for recording and the playhead's own controls.
        glass: "glass-lit text-[oklch(0.19_0.008_55)] hover:bg-glass-hot",
        // Unlit glass: a playback control at rest. It lights only while playing.
        glassOff:
          "border-line-strong bg-surface text-glass-ink hover:border-glass-ink",
        // Graphite: the recorder's body.
        graphite:
          "bg-graphite text-[oklch(0.96_0.002_80)] shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_1px_2px_oklch(0.2_0.005_60/0.35)] hover:bg-[color-mix(in_oklch,var(--graphite),white_8%)]",
        destructive:
          "bg-[color-mix(in_oklch,var(--destructive),white_88%)] text-destructive hover:bg-[color-mix(in_oklch,var(--destructive),white_80%)]",
        link: "h-auto! px-0! text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
      },
      size: {
        default: "h-9 gap-2 px-3.5 text-sm",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[0.9375rem]",
        icon: "size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
