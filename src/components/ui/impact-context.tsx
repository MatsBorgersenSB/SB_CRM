export function ImpactContext({
  label = "Why this matters",
  items,
}: {
  label?: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 border-l-2 border-carbon-blue/10 pl-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/35">
        {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[11px] leading-relaxed text-carbon-blue/55">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
