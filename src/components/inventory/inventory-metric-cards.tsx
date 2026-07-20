function velocityTone(velocity?: string): string {
  if (!velocity) return "text-carbon-blue/45";
  if (velocity.startsWith("+")) return "text-upcycle-orange";
  if (velocity.startsWith("-")) return "text-flame";
  return "text-carbon-blue/55";
}

export function InventoryMetricCards({
  metrics,
}: {
  metrics: {
    label: string;
    value: string;
    velocity?: string;
  }[];
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="border border-carbon-blue/15 bg-white px-3 py-2.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {metric.label}
          </p>
          <p className="mt-1 text-xs font-semibold tabular-nums text-carbon-blue">
            {metric.value}
          </p>
          {metric.velocity ? (
            <p
              className={`mt-0.5 font-mono text-[9px] tabular-nums ${velocityTone(metric.velocity)}`}
            >
              {metric.velocity}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
