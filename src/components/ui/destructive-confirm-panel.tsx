"use client";

type DestructiveConfirmPanelProps = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function DestructiveConfirmPanel({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
}: DestructiveConfirmPanelProps) {
  return (
    <div className="border border-thermal-red/25 bg-thermal-red/[0.04] p-3">
      <p className="text-xs font-semibold text-carbon-blue">{title}</p>
      <p className="mt-1 text-[11px] text-carbon-blue/60">{message}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void onConfirm()}
          className="border border-thermal-red/40 bg-thermal-red px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {loading ? "Deleting…" : confirmLabel}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
