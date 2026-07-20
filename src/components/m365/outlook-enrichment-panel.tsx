import type { SignatureSuggestion } from "@/lib/m365/signature-intelligence";

export function OutlookEnrichmentPanel({
  suggestions,
  onAccept,
  onIgnore,
}: {
  suggestions: SignatureSuggestion[];
  onAccept: () => void;
  onIgnore: () => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        Additional information found
      </p>
      <dl className="mt-2 space-y-1.5">
        {suggestions.map((item) => (
          <div key={item.id} className="text-[11px]">
            <dt className="font-semibold text-carbon-blue/55">{item.label}:</dt>
            <dd
              className={`mt-0.5 text-carbon-blue/75${item.id === "address" ? " whitespace-pre-line" : ""}`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 border border-upcycle-orange bg-upcycle-orange px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="flex-1 border border-carbon-blue/15 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/55"
        >
          Ignore
        </button>
      </div>
    </section>
  );
}
