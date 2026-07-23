import { NextResponse } from "next/server";
import { getPrisma, isPrismaConnectionError } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_VERSION = process.env.APP_VERSION?.trim() || "1.0.0";

/**
 * GET /api/health
 * Liveness + PostgreSQL connectivity probe for Docker / load balancers.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

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
