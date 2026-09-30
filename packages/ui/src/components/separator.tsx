import * as React from "react"
import { cn } from "@micmane/ui/lib/utils"
import { Separator as SeparatorPrimitive } from "radix-ui"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 from-transparent via-line-strong to-transparent data-horizontal:h-px data-horizontal:w-full data-horizontal:bg-linear-to-r data-vertical:w-px data-vertical:self-stretch data-vertical:bg-linear-to-b",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
