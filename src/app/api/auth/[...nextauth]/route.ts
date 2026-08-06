/**
 * App Router NextAuth route (Auth.js v5).
 *
 * v4 pattern `const handler = NextAuth(authOptions); export { handler as GET, handler as POST }`
 * is not valid in Auth.js v5 — `NextAuth()` returns `{ handlers: { GET, POST } }`.
 * Official equivalent: initialize once in `@/lib/auth` and re-export the handlers here.
 */
export { GET, POST } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
