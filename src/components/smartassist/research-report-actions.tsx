"use client";

import { useCallback, useState } from "react";
import { Download, FileText, Share2 } from "lucide-react";
import type { DeepResearchBriefing } from "@/types/deep-research";
import type { StoredResearchReport } from "@/types/research-report";
import type { ResearchReportExportFormat } from "@/types/research-report";

type Props = {
  briefing: DeepResearchBriefing;
  companyId?: string;
  dealId?: string;
  contactId?: string;
};

export function ResearchReportActions({ briefing, companyId, dealId, contactId }: Props) {
  const [report, setReport] = useState<StoredResearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/research-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefing,
          generatedBy: "SmartAssist",
          companyId,
          dealId,
          contactId,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to generate report");
      }
      const payload = (await response.json()) as { report: StoredResearchReport };
      setReport(payload.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate report");
    } finally {
      setBusy(false);
    }
  }, [briefing, companyId, dealId, contactId]);

  const downloadExport = useCallback(
    async (format: ResearchReportExportFormat) => {
      if (!report) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/research-reports/${encodeURIComponent(report.reportId)}/export?format=${format}`,
        );
        if (!response.ok) throw new Error("Export failed");
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="([^"]+)"/);
        const filename = match?.[1] ?? `report.${format === "sharepoint" ? "html" : format}`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setBusy(false);
      }
    },
    [report],
  );

  return (
    <div className="rounded-lg border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
        Research Report
      </p>
      <p className="mt-1 text-[10px] leading-relaxed text-carbon-blue/55">
        Generate a structured report stored in SharePoint and searchable in the knowledge base.
      </p>

      {!report ? (
        <button
          type="button"
          onClick={generateReport}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-60"
        >
          <FileText className="size-3" strokeWidth={2} />
          {busy ? "Generating…" : "Generate & Store Report"}
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] font-medium text-emerald-700">
            Stored · {report.reportId} · {report.typeLabel}
          </p>
          <p className="text-[9px] text-carbon-blue/45 truncate" title={report.metadata.sharePointUrl}>
            SharePoint: {report.metadata.sharePointPath}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => downloadExport("docx")}
              className="inline-flex items-center gap-1 rounded-md border border-carbon-blue/12 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue hover:border-upcycle-orange/30"
            >
              <Download className="size-3" strokeWidth={2} />
              DOCX
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => downloadExport("pdf")}
              className="inline-flex items-center gap-1 rounded-md border border-carbon-blue/12 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue hover:border-upcycle-orange/30"
            >
              <Download className="size-3" strokeWidth={2} />
              PDF
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => downloadExport("sharepoint")}
              className="inline-flex items-center gap-1 rounded-md border border-carbon-blue/12 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue hover:border-upcycle-orange/30"
            >
              <Share2 className="size-3" strokeWidth={2} />
              SharePoint Page
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-2 text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
}
