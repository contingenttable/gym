import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-border/60 bg-card/60 px-3 py-2 text-base shadow-sm backdrop-blur-md placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:shadow-[inset_0_1px_3px_rgba(0,0,0,0.14)] dark:focus-visible:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }