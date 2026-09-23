import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  default: "border-border/60 bg-muted/60 text-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
  outline: "border-border/60 bg-card/50 text-muted-foreground",
  warning: "border-primary/20 bg-accent text-accent-foreground",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium tracking-tight",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
