import "server-only";

export type ExtractedDocumentContent = {
  text: string;
  kind: "pdf" | "docx" | "pptx" | "xlsx" | "image" | "text" | "archive";
};

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
  bytes?: Buffer | Uint8Array | null;
}): boolean {
  const mime = (input.mimeType ?? "").toLowerCase();
  const name = (input.name ?? "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return true;
  if (input.bytes && input.bytes.length >= 5) {
    const header = Buffer.from(input.bytes.subarray(0, 5)).toString("ascii");
    if (header === "%PDF-") return true;
  }
  return false;
}

export function looksLikeImage(input: {
  name?: string | null;
  mimeType?: string | null;
  bytes?: Buffer | Uint8Array | null;
}): boolean {
  const mime = (input.mimeType ?? "").toLowerCase();
  const name = (input.name ?? "").toLowerCase();
  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|tiff?|svg|heic)$/i.test(name)
  ) {
    return true;
  }
  const b = input.bytes;
  if (b && b.length >= 4) {
    // PNG: 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
    // GIF: 47 49 46 38
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;
    // WEBP: RIFF....WEBP
    if (
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
    ) {
      return true;
    }
  }
  return false;
}

export function imageMediaTypeForLlm(input: {
  name?: string | null;
  mimeType?: string | null;
  bytes?: Buffer | Uint8Array | null;
}): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const mime = (input.mimeType ?? "").toLowerCase();
  const name = (input.name ?? "").toLowerCase();
  const b = input.bytes;
  if (b && b.length >= 4) {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
    if (
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[8] === 0x57 &&
      b[9] === 0x45
    ) {
      return "image/webp";
    }
  }
  if (mime.includes("png") || name.endsWith(".png")) return "image/png";
  if (mime.includes("jpeg") || mime.includes("jpg") || /\.(jpe?g)$/i.test(name)) {
    return "image/jpeg";
  }
  if (mime.includes("gif") || name.endsWith(".gif")) return "image/gif";
  if (mime.includes("webp") || name.endsWith(".webp")) return "image/webp";
  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function xmlToPlainText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<\/(w:p|a:p|p|row|tr|div|li|h[1-6])>/gi, "\n")
      .replace(/<(w:tab|w:br|br)\b[^>]*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim(),
  );
}

function looksLikeZipBytes(bytes: Buffer | Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

async function extractOpenXmlOrZipText(
  bytes: Buffer | Uint8Array,
  name: string,
): Promise<ExtractedDocumentContent> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const entryNames = Object.keys(zip.files);
  const lowerName = name.toLowerCase();

  // 1. PowerPoint (.pptx)
  const slideEntries = entryNames
    .filter((entry) => /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/i.test(entry))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (slideEntries.length > 0 || lowerName.endsWith(".pptx")) {
    const chunks: string[] = [];
    for (const entry of slideEntries) {
      const file = zip.file(entry);
      if (!file) continue;
      const xml = await file.async("string");
      const text = xmlToPlainText(xml);
      if (text) chunks.push(text);
    }
    return { text: chunks.join("\n").trim(), kind: "pptx" };
  }

  // 2. Word (.docx)
  const wordEntries = entryNames
    .filter((entry) => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(entry))
    .sort();
  if (wordEntries.length > 0 || lowerName.endsWith(".docx")) {
    const chunks: string[] = [];
    for (const entry of wordEntries) {
      const file = zip.file(entry);
      if (!file) continue;
      const xml = await file.async("string");
      const text = xmlToPlainText(xml);
      if (text) chunks.push(text);
    }
    return { text: chunks.join("\n").trim(), kind: "docx" };
  }

  // 3. Excel (.xlsx)
  const excelEntries = entryNames
    .filter((entry) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/i.test(entry))
    .sort();
  if (excelEntries.length > 0 || lowerName.endsWith(".xlsx")) {
    const chunks: string[] = [];
    for (const entry of excelEntries) {
      const file = zip.file(entry);
      if (!file) continue;
      const xml = await file.async("string");
      const text = xmlToPlainText(xml);
      if (text) chunks.push(text);
    }
    return { text: chunks.join("\n").trim(), kind: "xlsx" };
  }

  // 4. Generic ZIP archive with readable text/docs inside
  const chunks: string[] = [];
  for (const entry of entryNames.slice(0, 20)) {
    const file = zip.file(entry);
    if (!file || file.dir) continue;
    if (/\.(txt|csv|tsv|md|json|xml|html?)$/i.test(entry)) {
      const raw = await file.async("string");
      const cleaned = xmlToPlainText(raw);
      if (cleaned) chunks.push(`${entry}: ${cleaned}`);
    } else if (/\.pdf$/i.test(entry)) {
      const pdfBytes = await file.async("nodebuffer");
      const pdfText = await extractTextFromPdfBytes(pdfBytes).catch(() => "");
      if (pdfText) chunks.push(`${entry}: ${pdfText}`);
    }
  }
  return { text: chunks.join("\n").trim(), kind: "archive" };
}

function cleanEmailOrPlainText(raw: string, name: string): string {
  let text = raw.replace(/\u0000/g, " ");
  if (/\.eml$/i.test(name)) {
    // Strip large base64 attachment blocks from RFC-822 messages so only readable headers/body remain.
    text = text.replace(/Content-Transfer-Encoding:\s*base64[\s\S]*?(?=--\S|$)/gi, " ");
    text = text.replace(/[A-Za-z0-9+/=]{80,}/g, " ");
  }
  // Reject binary-looking strings where >15% of characters are non-printable control bytes.
  let controlCount = 0;
  const sample = text.slice(0, 1000);
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 65533) {
      controlCount += 1;
    }
  }
  if (sample.length > 0 && controlCount / sample.length > 0.15) {
    return "";
  }
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Extract readable text from any supported document or picture buffer:
 * PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), ZIP, SVG, EML, CSV, TXT, or Image.
 */
export async function extractTextFromDocumentBytes(input: {
  bytes: Buffer | Uint8Array;
  name?: string | null;
  mimeType?: string | null;
}): Promise<ExtractedDocumentContent> {
  const name = (input.name ?? "").trim();
  const mime = (input.mimeType ?? "").trim().toLowerCase();
  const buf = input.bytes instanceof Buffer ? input.bytes : Buffer.from(input.bytes);

  if (looksLikePdf({ name, mimeType: mime, bytes: buf })) {
    const text = await extractTextFromPdfBytes(buf).catch(() => "");
    return { text, kind: "pdf" };
  }

  if (looksLikeImage({ name, mimeType: mime, bytes: buf })) {
    if (name.toLowerCase().endsWith(".svg") || mime.includes("svg")) {
      const svgText = xmlToPlainText(buf.toString("utf8"));
      return { text: svgText, kind: "image" };
    }
    return { text: "", kind: "image" };
  }

  if (
    looksLikeZipBytes(buf) ||
    /\.(docx|pptx|xlsx|zip)$/i.test(name) ||
    mime.includes("openxmlformats") ||
    mime.includes("zip")
  ) {
    try {
      return await extractOpenXmlOrZipText(buf, name);
    } catch {
      return { text: "", kind: "archive" };
    }
  }

  const raw = buf.toString("utf8");
  const cleaned = cleanEmailOrPlainText(raw, name);
  return { text: cleaned, kind: "text" };
}

