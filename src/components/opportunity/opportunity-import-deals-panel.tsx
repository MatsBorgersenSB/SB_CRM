"use client";

/**
 * Lightweight deal import panel — paste/CSV intake placeholder aligned with
 * Companies Quick Import / Bulk Import action pattern (Michelin: one purpose).
 */
export function OpportunityImportDealsPanel({
  onClose,
}: {
  onClose?: () => void;
}) {
  return (
    <div className="border border-carbon-blue/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Import Deals
          </p>
          <p className="mt-1 text-[12px] text-carbon-blue/60">
            Paste deal rows or upload a CSV to create opportunities in bulk. Prefer{" "}
            <span className="font-medium text-carbon-blue">+ New Opportunity</span> when you
            need company + contact + SharePoint folder in one flow.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-carbon-blue"
          >
            Close
          </button>
        ) : null}
      </div>
      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
          Paste deals (Company · Opportunity · Value)
        </span>
        <textarea
          rows={5}
          placeholder={"Acme Plastics · Ottem pyrolysis unit · 850000\nNordic Recycle · Feedstock trial · 120000"}
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
        />
      </label>
      <p className="mt-2 text-[11px] text-carbon-blue/45">
        Bulk parse and create are not enabled yet — capture the list here, then create each
        opportunity with + New Opportunity for Reality First company linking.
      </p>
    </div>
  );
}
