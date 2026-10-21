import type { OfferingCategory, StandardBioOffering } from "@/types/offering";

const CUSTOM_PREFIX = "custom:";
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

export function normalizeOfferingName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function customOfferingId(category: OfferingCategory, name: string): string | null {
  const normalized = normalizeOfferingName(name);
  if (normalized.length < MIN_NAME_LENGTH || normalized.length > MAX_NAME_LENGTH) {
    return null;
  }
  return `${CUSTOM_PREFIX}${category}:${encodeURIComponent(normalized)}`;
}

/** User-added offering. The id carries the name, so labels survive without a second store. */
export function offeringFromCustomId(id: string): StandardBioOffering | undefined {
  if (!id.startsWith(CUSTOM_PREFIX)) return undefined;
  const rest = id.slice(CUSTOM_PREFIX.length);
  const split = rest.indexOf(":");
  if (split < 0) return undefined;
  const category = rest.slice(0, split);
  if (category !== "system" && category !== "product" && category !== "service") {
    return undefined;
  }
  let name = "";
  try {
    name = normalizeOfferingName(decodeURIComponent(rest.slice(split + 1)));
  } catch {
    return undefined;
  }
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) return undefined;

  return {
    id,
    name,
    category,
    summary: name,
    requiredInformation: [`What does the customer need from ${name}?`],
    suggestedStakeholderRoles: ["Decision Maker", "Technical Lead"],
    discoveryQuestions: [`What should ${name} deliver on this opportunity?`],
    qualificationSignals: [`Scope for ${name} is confirmed`],
    nextBestActionHints: [`Confirm what ${name} must include before proposing it.`],
  };
}

export function buildCustomOffering(
  category: OfferingCategory,
  name: string,
): StandardBioOffering | null {
  const id = customOfferingId(category, name);
  if (!id) return null;
  return offeringFromCustomId(id) ?? null;
}
