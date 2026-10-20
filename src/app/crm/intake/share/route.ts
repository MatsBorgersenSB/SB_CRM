import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Share-target fallback. When the service worker is active it intercepts this POST
 * and never reaches the server; without it, send the user to the intake page.
 */
export function POST(request: Request) {
  return NextResponse.redirect(new URL("/crm/intake", request.url), 303);
}
