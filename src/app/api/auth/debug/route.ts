import { NextResponse } from "next/server";
import { authTraceLog, buildAuthDebugSnapshot, isAuthTraceEnabled } from "@/lib/auth-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safe auth diagnostics for Vercel troubleshooting.
 * Never returns secrets — only presence flags and public URLs.
 *
 * Open: https://sb-crm-seven.vercel.app/api/auth/debug
 */
export async function GET() {
  // Diagnostics are opt-in; hide the route entirely in normal operation.
  if (!isAuthTraceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const snapshot = buildAuthDebugSnapshot();
  authTraceLog("[SmartCRM AuthTrace]", JSON.stringify({ step: "debug.snapshot", ...snapshot }));
  return NextResponse.json(
    {
      ok: true,
      purpose: "SmartCRM NextAuth / Azure AD diagnostics (no secrets)",
      howToUse: [
        "1. Open this URL before signing in",
        "2. Confirm AUTH_URL, secrets, and AZURE_AD_CLIENT_SECRET are true/set",
        "3. Sign in, then check Vercel → Deployment → Logs for [SmartCRM AuthTrace]",
        "4. Look for steps: route.*, callback.signIn, callback.jwt, events.signIn, route.error",
      ],
      snapshot,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
