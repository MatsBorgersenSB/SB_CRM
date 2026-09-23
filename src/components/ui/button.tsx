import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  outline:
    "border border-border/60 bg-card/50 text-foreground backdrop-blur-sm hover:bg-accent/80",
  ghost: "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground",
  secondary: "bg-muted text-foreground hover:bg-accent/80",
  destructive: "bg-destructive/15 text-destructive hover:bg-accent/80",
} as const;

const SIZES = {
  default: "h-9 px-3 text-sm",
  sm: "h-8 px-2.5 text-xs",
  lg: "h-10 px-4 text-sm",
  icon: "size-8",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium tracking-tight whitespace-nowrap",
        "transition-all duration-200 active:scale-[0.98]",
        "focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
