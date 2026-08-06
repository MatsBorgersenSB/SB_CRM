import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/lib/auth";
import { authTrace } from "@/lib/auth-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side Azure AD sign-in start (outside /api/auth catch-all).
 * Browser navigates here — we redirect to Microsoft Entra.
 *
 * Usage: /api/azure-start?callbackUrl=/
 */
export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") || "/";
  authTrace("azure-start.get", {
    callbackUrl,
    host: req.headers.get("host"),
    path: req.nextUrl.pathname,
  });

  try {
    const url = await signIn("azure-ad", {
      redirectTo: callbackUrl,
      redirect: false,
    });

    if (!url || typeof url !== "string") {
      throw new Error("signIn returned empty redirect URL");
    }

    authTrace("azure-start.redirect", {
      callbackUrl,
      to: url.startsWith("https://login.microsoftonline.com")
        ? "login.microsoftonline.com"
        : url.slice(0, 120),
    });

    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    authTrace("azure-start.error", { message, callbackUrl });
    console.error("[NextAuth] azure-start failed:", message, error);

    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("error", "OAuthSignin");
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(signInUrl);
  }
}
