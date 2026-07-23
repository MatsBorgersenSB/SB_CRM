import { NextResponse } from "next/server";
import { getDocumentRecordById } from "@/lib/smartdocs-ingestion";

/**
 * GET /api/documents/[id]/download
 * Streams stored attachment content (base64) for preview/download.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const doc = await getDocumentRecordById(id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (!doc.contentBase64) {
      return NextResponse.json(
        {
          error: "No file content stored for this document",
          name: doc.name,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
        },
        { status: 404 },
      );
    }

    const bytes = Buffer.from(doc.contentBase64, "base64");
    const mimeType = doc.mimeType || "application/octet-stream";
    const disposition = `inline; filename="${doc.name.replace(/"/g, "")}"`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("[documents download]", error);
    return NextResponse.json(
      {
        error: "Failed to download document",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
