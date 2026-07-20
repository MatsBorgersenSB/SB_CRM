/** Normalize user-entered website/domain for company storage. */
export function normalizeCompanyDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed
      .replace(/^(https?:\/\/)?(www\.)?/i, "")
      .split("/")[0]!
      .trim()
      .toLowerCase();
  }
}

export function formatCompanyWebsite(domain: string): string {
  return domain.trim();
}
