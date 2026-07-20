import { NextResponse } from "next/server";
import { getResearchReportById } from "@/lib/pipeline-db";
import {
  buildResearchReportExport,
  exportContentType,
  exportFilename,
} from "@/lib/research-report-export";
import type { ResearchReportExportFormat } from "@/types/research-report";

const VALID_FORMATS: ResearchReportExportFormat[] = ["docx", "pdf", "sharepoint"];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "pdf") as ResearchReportExportFormat;

  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const report = await getResearchReportById(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const content = await buildResearchReportExport(report, format);
  const filename = exportFilename(report, format);
  const contentType = exportContentType(format);

  if (typeof content === "string") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return new NextResponse(Buffer.from(content), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
