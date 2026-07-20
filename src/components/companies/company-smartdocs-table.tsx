import type { PipelineRow } from "@/types/pipeline";

function DocBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center border border-upcycle-orange/30 bg-upcycle-orange/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
      {label}
    </span>
  );
}

export function CompanySmartDocsTable({ documents }: { documents: PipelineRow[] }) {
  if (documents.length === 0) {
    return (
      <div className="border border-carbon-blue/10 px-3 py-6 text-center text-xs text-carbon-blue/50">
        No SmartDocs linked to this account.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-carbon-blue/10">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col style={{ width: 80 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 48 }} />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-carbon-blue/10 bg-carbon-blue/[0.03]">
            {[
              "ClientLookup",
              "DocCategory",
              "DocType",
              "Revision",
              "FileLeafRef",
            ].map((header) => (
              <th
                key={header}
                className="px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/45"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={doc.id}
              className="border-b border-carbon-blue/10 last:border-b-0"
            >
              <td className="px-2 py-1.5 font-mono text-[10px] text-carbon-blue/55">
                {doc.ClientLookup}
              </td>
              <td className="px-2 py-1.5">
                {doc.DocCategory ? <DocBadge label={doc.DocCategory} /> : "—"}
              </td>
              <td className="px-2 py-1.5">
                {doc.DocType ? <DocBadge label={doc.DocType} /> : "—"}
              </td>
              <td className="px-2 py-1.5 font-mono text-[10px] text-carbon-blue">
                {doc.Revision ?? "—"}
              </td>
              <td
                className="truncate px-2 py-1.5 font-mono text-[10px] text-carbon-blue/70"
                title={doc.FileLeafRef}
              >
                {doc.FileLeafRef}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
