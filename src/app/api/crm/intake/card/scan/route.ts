import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateCompany } from "@/lib/permissions";
import { POST as matchCard } from "../route";

export const dynamic = "force-dynamic";

const MODEL = "claude-3-5-haiku-latest";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const PROMPT = `Extract contact details from this business card into raw JSON:
{
  "name": "Full Name",
  "role": "Job Title",
  "companyName": "Company",
  "email": "email@domain.com",
  "phone": "+123456789"
}
Rules: Output valid JSON only. Leave unfound fields as empty strings. Never invent missing details.`;

type ExtractedCard = {
  name: string;
  role: string;
  companyName: string;
  email: string;
  phone: string;
};

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
    name: asString(record.name),
    role: asString(record.role),
    companyName: asString(record.companyName),
    email: EMAIL_PATTERN.test(email) ? email : "",
    phone: asString(record.phone),
  };
}

async function extractCard(
  client: Anthropic,
  base64: string,
  mediaType: SupportedMediaType,
): Promise<ExtractedCard | null> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
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
    return NextResponse.json({ error: "file field with an image is required" }, { status: 400 });
  }
  if (!isSupportedMediaType(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, GIF, or WebP" },
      { status: 415 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5 MB limit" }, { status: 413 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const client = new Anthropic({ apiKey });

    const [blob, extracted] = await Promise.all([
      put(file.name, file, { access: "public", addRandomSuffix: true }),
      extractCard(client, base64, file.type),
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
