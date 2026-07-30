import { Pool, type PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: Pool | undefined;
};

function resolveConnectionString(): string {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set for Prisma");
  }

  // Local Prisma Dev / Postgres often rejects TLS; keep sslmode=disable if absent.
  try {
    const url = new URL(raw);
    const host = url.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (isLocal && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "disable");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function createPool(): Pool {
  const connectionString = resolveConnectionString();
  const config: PoolConfig = {
    connectionString,
    // Keep the pool small for Next.js / Turbopack HMR — avoids pile-ups of dead sockets.
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  };
  const pool = new Pool(config);

  pool.on("error", (error) => {
    // Idle client errors (server closed connection) — reset on next getPrisma().
    console.warn("[prisma] Pool idle client error — will recreate on next use:", error.message);
    void resetPrisma("pool-error");
  });

  return pool;
}

function createPrismaClient(pool: Pool): PrismaClient {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Detects a stale PrismaClient singleton (common after `prisma generate`
 * while `next dev` keeps an old globalThis.prisma without new model delegates).
 */
function isClientCurrent(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const required = [
    "company",
    "contact",
    "opportunity",
    "meetingRecord",
    "meetingParticipantRecord",
    "meetingCommitmentRecord",
    "emailMessageRecord",
    "documentRecord",
    "externalIntegration",
    "webhookSubscription",
    "stakeholderInfluenceProfile",
    "accountHealthRecord",
    "expansionSignal",
    "workflowRule",
    "workflowExecution",
    "decisionJournal",
    "documentComplianceAudit",
    "project",
    "projectMilestone",
    "qualityInspection",
    "projectScopeChange",
    "commissioningLog",
    "rdExperimentLog",
    "eciInstrumentTag",
    "atexInterlock",
    "plcRelease",
    "workspaceProject",
  ] as const;
  return required.every((key) => {
    const value = (client as unknown as Record<string, unknown>)[key];
    return value != null && typeof value === "object";
  });
}

/** True when Postgres closed the socket or refused the connection. */
export function isPrismaConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; name?: string };
  const message = `${err.message ?? ""} ${err.name ?? ""}`;
  return (
    err.code === "P1001" ||
    err.code === "P1002" ||
    err.code === "P1017" ||
    err.code === "57P01" ||
    err.code === "57P02" ||
    err.code === "57P03" ||
    err.code === "ECONNRESET" ||
    err.code === "ECONNREFUSED" ||
    err.code === "ETIMEDOUT" ||
    /server has closed the connection/i.test(message) ||
    /connection terminated/i.test(message) ||
    /can't reach database server/i.test(message) ||
    /connection refused/i.test(message) ||
    /ConnectionReset/i.test(message)
  );
}

/** Tear down pool + client so the next getPrisma() opens fresh sockets. */
export async function resetPrisma(reason = "manual"): Promise<void> {
  const client = globalForPrisma.prisma;
  const pool = globalForPrisma.prismaPool;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaPool = undefined;

  if (client) {
    await client.$disconnect().catch(() => undefined);
  }
  if (pool) {
    await pool.end().catch(() => undefined);
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[prisma] Client reset (${reason})`);
  }
}

/** Fresh, schema-current Prisma client (recreates after generate / dead pool). */
export function getPrisma(): PrismaClient {
  if (isClientCurrent(globalForPrisma.prisma) && globalForPrisma.prismaPool) {
    return globalForPrisma.prisma;
  }

  // Dispose stale handles without awaiting — Next request paths must stay sync.
  const previousClient = globalForPrisma.prisma;
  const previousPool = globalForPrisma.prismaPool;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaPool = undefined;
  if (previousClient) {
    void previousClient.$disconnect().catch(() => undefined);
  }
  if (previousPool) {
    void previousPool.end().catch(() => undefined);
  }

  const pool = createPool();
  const client = createPrismaClient(pool);
  globalForPrisma.prismaPool = pool;
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Run a Prisma operation; on connection-closed errors, reset the pool and retry once.
 */
export async function withPrismaRetry<T>(
  operation: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  try {
    return await operation(getPrisma());
  } catch (error) {
    if (!isPrismaConnectionError(error)) throw error;
    await resetPrisma("connection-error-retry");
    return operation(getPrisma());
  }
}

/** Server-side Prisma accessor — prefer getPrisma() / withPrismaRetry(). */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
