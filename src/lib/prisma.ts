import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set for Prisma");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
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
    "stakeholderInfluenceProfile",
  ] as const;
  return required.every((key) => {
    const value = (client as unknown as Record<string, unknown>)[key];
    return value != null && typeof value === "object";
  });
}

/** Fresh, schema-current Prisma client (recreates after generate if needed). */
export function getPrisma(): PrismaClient {
  if (isClientCurrent(globalForPrisma.prisma)) {
    return globalForPrisma.prisma;
  }
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/** Server-side Prisma accessor — prefer getPrisma() so FS-008 models stay available. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
