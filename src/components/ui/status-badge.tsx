type StatusVariant = "active" | "success" | "pending" | "error";

const variantStyles: Record<StatusVariant, string> = {
  active: "bg-upcycle-orange/15 text-upcycle-orange border-upcycle-orange/30",
  success:
    "bg-emerald-500/12 text-emerald-700 border-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-400/35",
  pending: "bg-flame/25 text-carbon-blue border-flame/50",
  error: "bg-thermal-red/15 text-thermal-red border-thermal-red/30",
};

export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: StatusVariant;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
