import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateCompany } from "@/lib/permissions";
import { POST as matchCard } from "../route";

export const dynamic = "force-dynamic";

/** Claude 3.5 Haiku is retired (404). Override with ANTHROPIC_INTAKE_MODEL when a newer Haiku ships. */
const MODEL = process.env.ANTHROPIC_INTAKE_MODEL?.trim() || "claude-haiku-4-5";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Vercel request bodies cap at ~4.5 MB. */
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_PDF_PAGES = 2;
const MAX_OUTPUT_TOKENS = 350;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];
const PDF_MEDIA_TYPE = "application/pdf";

const SYSTEM_PROMPT =
  "You are a strict data extraction engine. Extract contact details from the business card image/document into valid JSON only, without markdown fences, explanation, or conversational filler. Schema: { fullName: string|null, jobTitle: string|null, companyName: string|null, email: string|null, phone: string|null, website: string|null, address: string|null }.";

type ExtractedCard = {
  name: string;
  role: string;
  companyName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
};

type ContentBlock = Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam;

type MatchResponse = {
  status: "existing_contact" | "candidates" | "no_match";
  suggestedAction: "open_contact" | "review_candidates" | "classify_and_create_new";
  existingContact: unknown | null;
  contactCandidates: unknown[];
  companyCandidates: unknown[];
};

type MatchResult = {
  status: MatchResponse["status"];
  suggestedAction: MatchResponse["suggestedAction"];
  candidates: {
    existingContact: unknown | null;
    contacts: unknown[];
    companies: unknown[];
  };
};

type ScanResponse = {
  extracted: ExtractedCard;
  evidenceUrl: string;
  matchResult: MatchResult;
};

function isSupportedMediaType(value: string): value is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseExtractedCard(text: string): ExtractedCard | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const email = asString(record.email).toLowerCase();
  return {
    name: asString(record.fullName),
    role: asString(record.jobTitle),
    companyName: asString(record.companyName),
    email: EMAIL_PATTERN.test(email) ? email : "",
    phone: asString(record.phone),
    website: asString(record.website),
    address: asString(record.address),
  };
}

/** Keeps only the first {@link MAX_PDF_PAGES} pages so extra pages never cost tokens. */
async function sliceFirstPages(bytes: Uint8Array): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes);
  if (source.getPageCount() <= MAX_PDF_PAGES) return bytes;

  const sliced = await PDFDocument.create();
  const pages = await sliced.copyPages(
    source,
    Array.from({ length: MAX_PDF_PAGES }, (_, index) => index),
  );
  for (const page of pages) sliced.addPage(page);
  return sliced.save();
}

async function extractCard(client: Anthropic, block: ContentBlock): Promise<ExtractedCard | null> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [block] }],
  });

  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n");
  return parseExtractedCard(text);
}

async function runMatch(request: Request, extracted: ExtractedCard): Promise<MatchResult> {
  if (!extracted.name && !extracted.email) {
    return {
      status: "no_match",
      suggestedAction: "classify_and_create_new",
      candidates: { existingContact: null, contacts: [], companies: [] },
    };
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  const response = await matchCard(
    new Request(new URL("/api/crm/intake/card", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify(extracted),
    }),
  );
  if (!response.ok) {
    throw new Error(`Card matching failed with status ${response.status}`);
  }

  const match = (await response.json()) as MatchResponse;
  return {
    status: match.status,
    suggestedAction: match.suggestedAction,
    candidates: {
      existingContact: match.existingContact,
      contacts: match.contactCandidates,
      companies: match.companyCandidates,
    },
  };
}

export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateCompany(role)) {
    return NextResponse.json(
      { error: "Insufficient role for business card intake" },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data body required" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "file field with an image or PDF is required" },
      { status: 400 },
    );
  }
  const isPdf = file.type === PDF_MEDIA_TYPE;
  if (!isPdf && !isSupportedMediaType(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPEG, PNG, GIF, WebP, or PDF" },
      { status: 415 },
    );
  }
  if (file.size > (isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) {
    return NextResponse.json(
      { error: isPdf ? "PDF exceeds 4 MB limit" : "Image exceeds 5 MB limit" },
      { status: 413 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is not configured" }, { status: 500 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    let block: ContentBlock;
    if (isPdf) {
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await sliceFirstPages(bytes);
      } catch {
        return NextResponse.json(
          { error: "Could not read this PDF. It may be encrypted or damaged" },
          { status: 422 },
        );
      }
      block = {
        type: "document",
        source: {
          type: "base64",
          media_type: PDF_MEDIA_TYPE,
          data: Buffer.from(pdfBytes).toString("base64"),
        },
      };
    } else {
      block = {
        type: "image",
        source: {
          type: "base64",
          media_type: file.type as SupportedMediaType,
          data: Buffer.from(bytes).toString("base64"),
        },
      };
    }

    const client = new Anthropic({ apiKey });
    const [blob, extracted] = await Promise.all([
      put(file.name, file, { access: "public", addRandomSuffix: true, token: blobToken }),
      extractCard(client, block),
    ]);

    if (!extracted) {
      return NextResponse.json(
        { error: "Could not read contact details from the image", evidenceUrl: blob.url },
        { status: 422 },
      );
    }

    const matchResult = await runMatch(request, extracted);
    const response: ScanResponse = {
      extracted,
      evidenceUrl: blob.url,
      matchResult,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[crm/intake/card/scan] failed", error);
    return NextResponse.json({ error: "Business card scan failed" }, { status: 500 });
  }
}
