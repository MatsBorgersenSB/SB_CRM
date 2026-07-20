export function CapacityProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 bg-carbon-blue/10">
        <div
          className="h-full bg-upcycle-orange/70"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-carbon-blue/70">
        {value}%
      </span>
    </div>
  );
}
