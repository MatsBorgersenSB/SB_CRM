import type { PipelineRow } from "@/types/pipeline";

function SavedBadge() {
  return (
    <span className="inline-flex items-center border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
      Saved
    </span>
  );
}

export function SmartDocsComplianceLedger({
  transactions,
}: {
  transactions: PipelineRow[];
}) {
  if (transactions.length === 0) {
    return (
      <section className="border border-carbon-blue/15 bg-white">
        <header className="border-b border-carbon-blue/10 px-3 py-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            SmartDocs Compliance Queue
          </h2>
        </header>
        <div className="px-3 py-6 text-center text-xs text-carbon-blue/50">
          No parsed documents in pipeline-db.json.
        </div>
      </section>
    );
  }

  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          SmartDocs Compliance Queue
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: 88 }} />
            <col />
            <col style={{ width: 72 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/15 bg-carbon-blue/[0.03]">
              {["ClientLookup", "DocType", "Status"].map((header) => (
                <th
                  key={header}
                  className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((row) => (
              <tr
                key={row.id}
                className="border-b border-carbon-blue/10 last:border-b-0 hover:bg-flame/10"
              >
                <td className="px-2 py-1.5 font-mono text-[11px] text-carbon-blue/55">
                  {row.ClientLookup}
                </td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex items-center border border-upcycle-orange/30 bg-upcycle-orange/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
                    {row.DocType}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <SavedBadge />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
