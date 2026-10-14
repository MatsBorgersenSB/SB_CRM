import "server-only";

/**
 * Extract readable text from a PDF buffer. Identity/classification is not enough —
 * permits and similar documents must be read as knowledge.
 */
export async function extractTextFromPdfBytes(bytes: Buffer | Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const data = bytes instanceof Buffer ? new Uint8Array(bytes) : bytes;
  const pdf = await getDocumentProxy(data);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text)
    ? extracted.text.join("\n")
    : String(extracted.text ?? "");
  return text.replace(/\u0000/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

export function looksLikePdf(input: {
  name?: string | null;
  mimeType?: string | null;
}): boolean {
  const mime = (input.mimeType ?? "").toLowerCase();
  const name = (input.name ?? "").toLowerCase();
  return mime.includes("pdf") || name.endsWith(".pdf");
}
