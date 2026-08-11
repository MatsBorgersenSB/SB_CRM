import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-env";
import {
  mintOutlookBridgeToken,
  useSecureAuthCookies,
} from "@/lib/outlook-dialog-bridge";
import { authTrace } from "@/lib/auth-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Office Dialog → task pane session bridge (create).
 * Dialog has first-party cookies after NextAuth; task pane iframe often cannot
 * read them. Mint a short-lived bridge token for messageParent → claim.
 */
export async function POST(req: NextRequest) {
  const secureCookie = useSecureAuthCookies();
  const token = await getToken({
    req,
    secret: resolveAuthSecret(),
    secureCookie,
  });

  if (!token?.email) {
    authTrace("outlook.dialog-bridge.create.unauthorized", {
      secureCookie,
      cookieNames: req.cookies
        .getAll()
        .map((c) => c.name)
        .filter((n) => /auth|session/i.test(n)),
    });
    return NextResponse.json(
      { error: "No SmartCRM session in dialog", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const bridgeToken = await mintOutlookBridgeToken(token);
  authTrace("outlook.dialog-bridge.create.ok", {
    email: typeof token.email === "string" ? token.email : null,
  });

  return NextResponse.json(
    { bridgeToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}
