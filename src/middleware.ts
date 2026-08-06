import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAzureAdAuthConfigured } from "@/lib/auth-env";

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/auth/signin")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  if (pathname.startsWith("/outlook")) return true;
  if (pathname.startsWith("/outlook-addin")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  // Until Azure AD + AUTH_SECRET are configured, do not lock the app.
  if (!isAzureAdAuthConfigured()) {
    return NextResponse.next();
  }

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
