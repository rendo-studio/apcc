import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] px-2.5 py-0.5 text-[11px] font-medium tracking-normal text-[color:var(--color-muted-foreground)]",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
