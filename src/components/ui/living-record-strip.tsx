/**
 * Living Records — a record is never static. One calm line of what is alive right now.
 */
export function LivingRecordStrip({
  items,
}: {
  items: Array<{ label: string; value: string; highlight?: boolean }>;
}) {
  if (items.length === 0) return null;

  return (
    <p className="text-[11px] leading-relaxed text-carbon-blue/55">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? " · " : null}
          {item.label}{" "}
          <span
            className={`font-semibold ${
              item.highlight ? "text-upcycle-orange" : "text-carbon-blue"
            }`}
          >
            {item.value}
          </span>
        </span>
      ))}
    </p>
  );
}
