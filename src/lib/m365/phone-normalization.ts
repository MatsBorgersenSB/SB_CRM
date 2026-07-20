/**
 * Preserve explicit international dialing prefixes from signatures.
 * Never strip country codes. Never add codes that were not detected.
 */

const INTERNATIONAL_COMPACT = /^\+(\d{5,15})$/;
const INTERNATIONAL_SPACED = /^(\+\d{1,3})\s+(.+)$/;

function groupNationalDigits(digits: string): string {
  const normalized = digits.replace(/\D/g, "");
  if (!normalized) return "";

  if (normalized.length >= 6) {
    return normalized.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }

  return normalized;
}

function splitCompactInternational(value: string): { cc: string; national: string } | null {
  const match = value.match(INTERNATIONAL_COMPACT);
  if (!match?.[1]) return null;

  const all = match[1];
  const candidates: Array<{ cc: string; national: string }> = [];

  for (const len of [1, 2, 3]) {
    if (all.length <= len) continue;
    const national = all.slice(len);
    if (national.length < 6 || national.length > 12) continue;
    candidates.push({ cc: `+${all.slice(0, len)}`, national });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const score = (national: string) => {
      if (national.length >= 8 && national.length <= 10) return 0;
      return Math.abs(national.length - 9);
    };
    return score(a.national) - score(b.national) || b.cc.length - a.cc.length;
  });

  return candidates[0] ?? null;
}

/** Normalize spacing while preserving any detected +country code. */
export function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim().replace(/\s{2,}/g, " ");
  if (!trimmed) return "";

  if (!trimmed.includes("+")) {
    return trimmed.replace(/[().-]/g, " ").replace(/\s+/g, " ").trim();
  }

  const cleaned = trimmed.replace(/[().-]/g, " ").replace(/\s+/g, " ").trim();
  const compact = cleaned.replace(/[^\d+]/g, "");

  const spaced = cleaned.match(INTERNATIONAL_SPACED);
  if (spaced?.[1] && spaced[2]) {
    const cc = spaced[1];
    const nationalDigits = spaced[2].replace(/\D/g, "");
    if (!nationalDigits) return cc;
    const national = spaced[2].includes(" ")
      ? spaced[2].replace(/[().-]/g, " ").replace(/\s+/g, " ").trim()
      : groupNationalDigits(nationalDigits);
    return `${cc} ${national}`.trim();
  }

  if (INTERNATIONAL_COMPACT.test(compact)) {
    const split = splitCompactInternational(compact);
    if (split) {
      return `${split.cc} ${groupNationalDigits(split.national)}`.trim();
    }
  }

  return cleaned;
}

/** True when value includes an explicit international prefix. */
export function hasExplicitCountryCode(value: string): boolean {
  return value.trim().includes("+");
}
