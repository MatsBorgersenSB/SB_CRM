import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/auth/signin")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  // Machine auth for scheduled jobs (Bearer / x-cron-secret) — not a user-session bypass.
  if (pathname.startsWith("/api/cron")) return true;
  return false;
}

/**
 * Strict auth guard: unauthenticated users are always redirected to sign-in.
 * No environment-variable bypass.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signInUrl = new URL("/auth/signin", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
