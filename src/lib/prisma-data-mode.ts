/**
 * JSON seed (Nordic Polymers, Circular Textiles, …) is for local/CI only.
 * Live production — including `next build` on Vercel — must never mask Prisma
 * with demo opportunities or companies.
 */
export function shouldFallbackToJsonPortfolio(): boolean {
  const registryConfigured = Boolean(
    process.env.DATABASE_URL || process.env.DIRECT_URL,
  );
  if (registryConfigured && process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
}
