import type { ConversionBatchStatus } from "@/lib/conversions-data";

const statusLabels: Record<ConversionBatchStatus, string> = {
  active: "Active",
  success: "Converted",
  pending: "Queued",
  error: "Interrupted",
};

const statusStyles: Record<ConversionBatchStatus, string> = {
  active: "border-upcycle-orange/30 bg-upcycle-orange/15 text-upcycle-orange",
  success: "border-upcycle-orange/30 bg-upcycle-orange/15 text-upcycle-orange",
  pending: "border-flame/40 bg-flame/20 text-carbon-blue",
  error: "border-carbon-blue/20 bg-carbon-blue/5 text-carbon-blue/60",
};

export function ConversionStatusBadge({
  status,
}: {
  status: ConversionBatchStatus;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
