import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap rounded-lg border border-border/60 bg-muted/50 p-0.5 backdrop-blur-sm",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            variant={active ? "secondary" : "ghost"}
            size="sm"
            role="tab"
            aria-selected={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3",
              active && "bg-card text-foreground shadow-sm hover:bg-card",
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
