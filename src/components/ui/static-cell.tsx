type StaticCellProps = {
  value: string;
  mono?: boolean;
  bold?: boolean;
  badge?: boolean;
  focused?: boolean;
  className?: string;
};

export function StaticCell({
  value,
  mono = false,
  bold = false,
  badge = false,
  focused = false,
  className = "",
}: StaticCellProps) {
  const base = badge
    ? "inline-flex min-w-[40px] items-center justify-center border border-carbon-blue/15 bg-carbon-blue/[0.03] px-1.5 py-0.5"
    : "block w-full truncate text-left text-xs";

  return (
    <span
      className={`${base} ${mono ? "font-mono text-[11px] tabular-nums text-carbon-blue/65" : "text-carbon-blue"} ${bold ? "font-semibold" : ""} ${focused ? "ring-1 ring-upcycle-orange/30 ring-inset" : ""} ${className}`}
    >
      {value}
    </span>
  );
}
