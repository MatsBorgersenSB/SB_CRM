import type { CreateSmartDocInput, SmartDocLibraryRecord } from "@/types/smartdoc-library";

/** Direct-to-SharePoint fragments (no Vercel limit). Multiple of 320 KiB. */
const DIRECT_FRAGMENT_BYTES = 20 * 320 * 1024;
/** Proxied fragments must stay under Vercel's ~4.5MB body limit. */
const PROXY_FRAGMENT_BYTES = 10 * 320 * 1024;
/** Multipart through Vercel is only safe for small files when Graph is off. */
const MULTIPART_SAFE_BYTES = 3_200_000;

type UploadScope = {
  kind: "opportunity" | "company" | "project";
  dealId?: string;
  companyId?: string;
  projectId?: string;
};

type ParseBody = {
  document?: SmartDocLibraryRecord;
  error?: string;
  code?: string;
};

function parseApiBody(raw: string, status: number): ParseBody {
  if (!raw.trim()) {
    return { error: `Import failed (${status})` };
  }
  try {
    return JSON.parse(raw) as ParseBody;
  } catch {
    return { error: raw.replace(/\s+/g, " ").trim().slice(0, 280) };
  }
}

async function postJson(
  url: string,
  headers: HeadersInit,
  body: unknown,
): Promise<{ status: number; parsed: ParseBody; raw: string }> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  return { status: response.status, parsed: parseApiBody(raw, response.status), raw };
}

function contentRange(start: number, end: number, total: number): string {
  return `bytes ${start}-${end}/${total}`;
}

async function putChunkDirect(
  uploadUrl: string,
  range: string,
  blob: Blob,
): Promise<{ complete: boolean; item?: { itemId: string; webUrl: string; name: string } }> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(blob.size),
      "Content-Range": range,
      "Content-Type": "application/octet-stream",
    },
    body: blob,
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`SharePoint upload failed (${response.status}): ${raw.slice(0, 180)}`);
  }
  if (!raw.trim()) return { complete: false };
  const parsed = JSON.parse(raw) as {
    id?: string;
    webUrl?: string;
    name?: string;
  };
  if (parsed.id && parsed.webUrl) {
    return {
      complete: true,
      item: { itemId: parsed.id, webUrl: parsed.webUrl, name: parsed.name ?? "" },
    };
  }
  return { complete: false };
}

async function putChunkProxy(
  headers: HeadersInit,
  uploadUrl: string,
  range: string,
  blob: Blob,
): Promise<{ complete: boolean; item?: { itemId: string; webUrl: string; name: string } }> {
  const form = new FormData();
  form.append("uploadUrl", uploadUrl);
  form.append("contentRange", range);
  form.append("chunk", blob, "chunk");

  const response = await fetch("/api/smartdocs/upload-chunk", {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  const raw = await response.text();
  const parsed = parseApiBody(raw, response.status) as ParseBody & {
    complete?: boolean;
    item?: { itemId: string; webUrl: string; name: string } | null;
  };
  if (!response.ok) {
    throw new Error(parsed.error ?? `SharePoint upload failed (${response.status})`);
  }
  return {
    complete: Boolean(parsed.complete),
    item: parsed.item ?? undefined,
  };
}

async function uploadFileToSession(
  headers: HeadersInit,
  uploadUrl: string,
  file: File,
): Promise<{ itemId: string; webUrl: string }> {
  const total = file.size;
  let offset = 0;
  let useDirect = true;
  let fragment = DIRECT_FRAGMENT_BYTES;
  let item: { itemId: string; webUrl: string } | undefined;

  while (offset < total) {
    const end = Math.min(offset + fragment, total);
    const blob = file.slice(offset, end);
    const range = contentRange(offset, end - 1, total);

    try {
      const result = useDirect
        ? await putChunkDirect(uploadUrl, range, blob)
        : await putChunkProxy(headers, uploadUrl, range, blob);
      if (result.item) item = result.item;
    } catch (error) {
      if (!useDirect) throw error;
      useDirect = false;
      fragment = PROXY_FRAGMENT_BYTES;
      continue;
    }

    offset = end;
  }

  if (!item?.itemId || !item.webUrl) {
    throw new Error("SharePoint accepted the file but did not return a document link.");
  }
  return item;
}

async function postMultipart(
  endpoint: string,
  headers: HeadersInit,
  payload: CreateSmartDocInput & { LinkedProjectId?: string },
  file: File,
): Promise<SmartDocLibraryRecord> {
  const form = new FormData();
  form.append("DocCategory", payload.DocCategory);
  form.append("DocType", payload.DocType);
  form.append("DocumentName", payload.DocumentName);
  if (payload.originalFileName) form.append("originalFileName", payload.originalFileName);
  if (payload.DocumentSetID) form.append("DocumentSetID", payload.DocumentSetID);
  if (payload.Origin) form.append("Origin", payload.Origin);
  if (payload.Counterparty) form.append("Counterparty", payload.Counterparty);
  if (payload.LinkedProjectId) form.append("LinkedProjectId", payload.LinkedProjectId);
  form.append("file", file, file.name);

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  const raw = await response.text();
  const parsed = parseApiBody(raw, response.status);
  if (!response.ok) {
    throw new Error(parsed.error ?? "Failed to create document");
  }
  if (!parsed.document) {
    throw new Error(parsed.error ?? "Import succeeded but no document was returned");
  }
  return parsed.document;
}

/**
 * File a SmartDoc: bytes go to SharePoint (Graph upload session).
 * SmartCRM only receives metadata + the SharePoint item id.
 */
export async function importSmartDocWithFile(input: {
  endpoint: string;
  headers: HeadersInit;
  payload: CreateSmartDocInput & { LinkedProjectId?: string };
  file: File;
  scope: UploadScope;
}): Promise<SmartDocLibraryRecord> {
  const session = await postJson("/api/smartdocs/upload-session", input.headers, {
    scope: input.scope.kind,
    dealId: input.scope.dealId,
    companyId: input.scope.companyId,
    projectId: input.scope.projectId,
    fileName: input.file.name,
  });

  if (session.status === 409 && session.parsed.code === "GRAPH_UNAVAILABLE") {
    if (input.file.size > MULTIPART_SAFE_BYTES) {
      throw new Error(
        "This file is too large to import here. Connect SharePoint so presentations go straight to the document library.",
      );
    }
    return postMultipart(input.endpoint, input.headers, input.payload, input.file);
  }

  if (session.status >= 400 || !("uploadUrl" in (session.parsed as object))) {
    const parsed = session.parsed as ParseBody & { uploadUrl?: string };
    throw new Error(parsed.error ?? "Could not open a SharePoint upload.");
  }

  const uploadUrl = (session.parsed as ParseBody & { uploadUrl?: string }).uploadUrl;
  if (!uploadUrl) {
    throw new Error("Could not open a SharePoint upload.");
  }

  const filed = await uploadFileToSession(input.headers, uploadUrl, input.file);

  const complete = await postJson(input.endpoint, input.headers, {
    ...input.payload,
    originalFileName: input.payload.originalFileName ?? input.file.name,
    mimeType: input.file.type || undefined,
    sizeBytes: input.file.size,
    sharepointItemId: filed.itemId,
    sharepointWebUrl: filed.webUrl,
  });

  if (complete.status >= 400 || !complete.parsed.document) {
    throw new Error(
      complete.parsed.error ?? "The file reached SharePoint but SmartCRM could not file it.",
    );
  }
  return complete.parsed.document;
}
