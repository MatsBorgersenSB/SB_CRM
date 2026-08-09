import { NextResponse } from "next/server";

/**
 * Authorize cron callers with CRON_SECRET (Bearer or x-cron-secret).
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;
  const provided = bearer || headerSecret;

  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
