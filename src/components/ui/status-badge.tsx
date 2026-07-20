type StatusVariant = "active" | "success" | "pending" | "error";

const variantStyles: Record<StatusVariant, string> = {
  active: "bg-upcycle-orange/15 text-upcycle-orange border-upcycle-orange/30",
  success: "bg-upcycle-orange/15 text-upcycle-orange border-upcycle-orange/30",
  pending: "bg-flame/20 text-carbon-blue border-flame/40",
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
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
