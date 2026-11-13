import JSZip from "jszip";
import { readXlsxGrid } from "@/lib/contact-spreadsheet";
import { diffImportAnswers, formatAttachmentsForExcel } from "@/lib/query-pack";
import type { QueryPack, QueryPackImportResult, QueryPosition } from "@/types/query-pack";

/**
 * Professional Q&A / RFI register — always-included recipient-facing columns.
 * Stable import keys remain in the file (Q&A Ref + system columns at the end).
 */
export const PROFESSIONAL_QA_HEADERS = [
  "Q&A Ref",
  "Discipline",
  "Question",
  "Issued To (Company)",
  "Issued To (Contact)",
  "Date Issued",
  "Response Required By",
  "Status",
  "Answer",
  "Answered By",
  "Date Answered",
  "Clarification / Comment",
  "References / Attachments",
  "Project / Opportunity",
  // System columns — do not delete (round-trip import)
  "QuestionId",
  "CompanyId",
  "ContactId",
  "PackId",
  "ScopeId",
] as const;

/** Columns shown in the in-app register preview (no system IDs). */
export const PROFESSIONAL_QA_VIEW_HEADERS = PROFESSIONAL_QA_HEADERS.slice(0, 14);

export type QueryPackExcelMeta = {
  packId: string;
  scopeId: string;
  /** Display name of project or opportunity */
  scopeTitle: string;
  /** ISO or YYYY-MM-DD */
  issuedAt?: string;
  issuedBy?: string;
};

function escapeXml(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function buildSheetXml(rows: string[][]): string {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const ref = `${colName(colIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function formatDateYmd(value?: string): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function statusLabel(status: QueryPosition["status"]): string {
  if (status === "answered") return "Answered";
  if (status === "waived") return "Closed — N/A";
  return "Open";
}

function disciplineLabel(type: QueryPosition["type"]): string {
  return type === "technical" ? "Technical" : "Commercial";
}

export function positionsToGrid(
  positions: QueryPosition[],
  meta: QueryPackExcelMeta,
): string[][] {
  const issued = formatDateYmd(meta.issuedAt) || formatDateYmd(new Date().toISOString());
  const header = [...PROFESSIONAL_QA_HEADERS];
  const body = positions.map((row) => [
    row.questionId,
    disciplineLabel(row.type),
    row.question,
    row.companyTitle ?? "",
    row.contactTitle ?? "",
    issued,
    row.responseRequiredBy ? formatDateYmd(row.responseRequiredBy) : "",
    statusLabel(row.status),
    row.answer ?? "",
    "",
    row.provenance?.importedAt ? formatDateYmd(row.provenance.importedAt) : "",
    row.comment ?? "",
    formatAttachmentsForExcel(row.attachments),
    meta.scopeTitle,
    row.questionId,
    row.companyId ?? "",
    row.contactId ?? "",
    meta.packId,
    meta.scopeId,
  ]);
  return [header, ...body];
}

export function positionsToViewGrid(
  positions: QueryPosition[],
  meta: QueryPackExcelMeta,
): { headers: string[]; rows: string[][] } {
  const full = positionsToGrid(positions, meta);
  const headers = [...PROFESSIONAL_QA_VIEW_HEADERS];
  const rows = full.slice(1).map((line) => line.slice(0, headers.length));
  return { headers, rows };
}

export async function buildQueryPackXlsx(
  positions: QueryPosition[],
  meta: QueryPackExcelMeta,
): Promise<Uint8Array> {
  const grid = positionsToGrid(positions, meta);
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  const xl = zip.folder("xl");
  xl?.file(
    "workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Q&amp;A" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  );
  xl?.folder("_rels")?.file(
    "workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  );
  xl?.folder("worksheets")?.file("sheet1.xml", buildSheetXml(grid));

  const buffer = await zip.generateAsync({ type: "uint8array" });
  return buffer;
}

function normalizeHeaderKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Resolve a column by professional heading or legacy alias. */
function headerIndex(headers: string[], aliases: string[]): number {
  const wanted = aliases.map(normalizeHeaderKey);
  return headers.findIndex((header) => wanted.includes(normalizeHeaderKey(header)));
}

export function gridToImportRows(grid: string[][]): {
  rows: Array<{
    questionId: string;
    answer: string;
    comment: string;
    answeredAt: string;
    companyId?: string;
  }>;
  unmatchedRaw: Array<{ reason: string; raw: Record<string, string> }>;
} {
  if (grid.length === 0) return { rows: [], unmatchedRaw: [] };
  const headers = grid[0] ?? [];
  const idCol = headerIndex(headers, [
    "QuestionId",
    "Q&A Ref",
    "QA Ref",
    "Q A Ref",
    "Ref",
  ]);
  const answerCol = headerIndex(headers, ["Answer", "Response", "Reply"]);
  const commentCol = headerIndex(headers, [
    "Clarification / Comment",
    "Clarification Comment",
    "Comment",
    "Notes",
    "Clarification",
  ]);
  const answeredCol = headerIndex(headers, [
    "Date Answered",
    "AnsweredAt",
    "Response Date",
    "Answer Date",
  ]);
  const companyIdCol = headerIndex(headers, ["CompanyId", "Company ID"]);

  const rows: Array<{
    questionId: string;
    answer: string;
    comment: string;
    answeredAt: string;
    companyId?: string;
  }> = [];
  const unmatchedRaw: Array<{ reason: string; raw: Record<string, string> }> = [];

  for (const line of grid.slice(1)) {
    const raw: Record<string, string> = {};
    headers.forEach((header, index) => {
      raw[header] = line[index] ?? "";
    });
    const questionId = idCol >= 0 ? (line[idCol] ?? "").trim() : "";
    if (!questionId) {
      unmatchedRaw.push({
        reason: "Missing Q&A Ref / QuestionId — cannot auto-match",
        raw,
      });
      continue;
    }
    rows.push({
      questionId,
      answer: answerCol >= 0 ? (line[answerCol] ?? "").trim() : "",
      comment: commentCol >= 0 ? (line[commentCol] ?? "").trim() : "",
      answeredAt: answeredCol >= 0 ? (line[answeredCol] ?? "").trim() : "",
      companyId: companyIdCol >= 0 ? (line[companyIdCol] ?? "").trim() || undefined : undefined,
    });
  }

  return { rows, unmatchedRaw };
}

export async function parseQueryPackXlsx(
  pack: QueryPack,
  buffer: ArrayBuffer,
): Promise<QueryPackImportResult> {
  const grid = await readXlsxGrid(buffer);
  const { rows, unmatchedRaw } = gridToImportRows(grid);
  const diff = diffImportAnswers(pack, rows);
  return {
    proposals: diff.proposals,
    unmatched: [...unmatchedRaw, ...diff.unmatched],
  };
}
