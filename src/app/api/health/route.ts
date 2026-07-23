import { NextResponse } from "next/server";
import { getPrisma, isPrismaConnectionError } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_VERSION = process.env.APP_VERSION?.trim() || "1.0.0";

/**
 * GET /api/health
 * Liveness + PostgreSQL connectivity probe for Docker / load balancers.
 * Soft mode (`E2E=1` env or `?e2e=1`) keeps status "ok" when DB is down — for Playwright smoke.
 */
export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const url = new URL(request.url);
  const softE2E =
    process.env.E2E === "1" ||
    url.searchParams.get("e2e") === "1";

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        timestamp,
        database: "connected",
        version: APP_VERSION,
      },
      { status: 200 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error("[health]", detail);

    if (softE2E) {
      return NextResponse.json(
        {
          status: "ok",
          timestamp,
          database: "disconnected",
          version: APP_VERSION,
          detail: isPrismaConnectionError(error)
            ? "database_unreachable"
            : "database_check_failed",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        database: "disconnected",
        version: APP_VERSION,
        detail: isPrismaConnectionError(error) ? "database_unreachable" : "database_check_failed",
      },
      { status: 503 },
    );
  }
}
