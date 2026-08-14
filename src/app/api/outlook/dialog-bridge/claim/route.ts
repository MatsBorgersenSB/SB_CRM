import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieOptions,
  mintSessionTokenFromBridge,
  readOutlookBridgeToken,
  sessionCookieName,
  useSecureAuthCookies,
} from "@/lib/outlook-dialog-bridge";
import { authTrace } from "@/lib/auth-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Task pane claims the dialog bridge token and receives a Set-Cookie in the
 * iframe cookie partition (where SameSite=Lax dialog cookies never land).
 */
export async function POST(req: NextRequest) {
  let bridgeToken = "";
  try {
    const body = (await req.json()) as { bridgeToken?: string };
    bridgeToken = body.bridgeToken?.trim() || "";
  } catch {
    bridgeToken = "";
  }

  if (!bridgeToken) {
    return NextResponse.json(
      { error: "Missing bridgeToken", code: "BRIDGE_REQUIRED" },
      { status: 400 },
    );
  }

  const bridge = await readOutlookBridgeToken(bridgeToken);
  if (!bridge?.email) {
    authTrace("outlook.dialog-bridge.claim.invalid", {});
    return NextResponse.json(
      { error: "Invalid or expired bridge token", code: "BRIDGE_INVALID" },
      { status: 401 },
    );
  }

  const secure = useSecureAuthCookies();
  const sessionJwt = await mintSessionTokenFromBridge(bridge);
  const cookieName = sessionCookieName(secure);
  const maxAge = 60 * 60 * 8;

  const response = NextResponse.json(
    {
      ok: true,
      user: {
        email: bridge.email,
        name: typeof bridge.name === "string" ? bridge.name : null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(cookieName, sessionJwt, {
    ...authCookieOptions(secure),
    maxAge,
  });

  authTrace("outlook.dialog-bridge.claim.ok", {
    email: typeof bridge.email === "string" ? bridge.email : null,
    cookieName,
    sameSite: authCookieOptions(secure).sameSite,
    partitioned: Boolean(authCookieOptions(secure).partitioned),
  });

  return response;
}
