import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * App Router NextAuth handlers (Auth.js v5).
 * Wrapped so unhandled errors return JSON instead of an HTML 500 crash page.
 *
 * Note: Auth.js v5 exports `{ GET, POST }` handlers (not a single v4-style handler).
 */
async function safeAuthHandler(method: "GET" | "POST", req: NextRequest) {
  try {
    return await handlers[method](req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[NextAuth] ${method} /api/auth crash:`, message, error);
    return NextResponse.json(
      {
        error: "Authentication service error",
        detail: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return safeAuthHandler("GET", req);
}

export async function POST(req: NextRequest) {
  return safeAuthHandler("POST", req);
}
