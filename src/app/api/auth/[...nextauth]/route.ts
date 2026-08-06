import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wrap Auth.js handlers so failures return JSON (not HTML 500),
 * which otherwise surfaces in the browser as:
 * SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 */
async function safeAuth(method: "GET" | "POST", req: NextRequest) {
  try {
    return await handlers[method](req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[NextAuth] ${method} crash:`, message, error);
    return NextResponse.json(
      { error: "Authentication service error", detail: message },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return safeAuth("GET", req);
}

export async function POST(req: NextRequest) {
  return safeAuth("POST", req);
}
