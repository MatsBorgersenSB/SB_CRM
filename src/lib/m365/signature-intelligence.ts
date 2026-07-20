/** Rule-based signature extraction — detected text only, no inference. */

import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";

export type SignatureFieldId =
  | "jobTitle"
  | "company"
  | "email"
  | "mobile"
  | "phone"
  | "website"
  | "address";

export type SignatureSuggestion = {
  id: SignatureFieldId;
  label: string;
  value: string;
};

export type SignatureEnrichment = {
  suggestions: SignatureSuggestion[];
};

const MAX_SUGGESTIONS = 6;

const SUGGESTION_ORDER: SignatureFieldId[] = [
  "jobTitle",
  "company",
  "mobile",
  "phone",
  "email",
  "website",
  "address",
];

const TITLE_KEYWORDS =
  /\b(manager|director|engineer|officer|lead|head|vp|president|specialist|coordinator|supervisor|analyst|consultant|chief|executive|sponsor|procurement|compliance|founder|co-founder|cofounder|ceo|cto|cfo|coo|partner|owner|fundador|director\s+general|marketing)\b/i;

const ROLE_COMPANY_PATTERN = /^(.+?)\s+(?:de|del|d'|at|@|for|en|bei|von)\s+(.+)$/i;

const COMPANY_SUFFIX =
  /\b(AS|ASA|AB|Oy|Ltd|Limited|Inc|Corp|GmbH|AG|SA|SRL|BV|PLC|Group|Co\.|Norge|Nordic)\b/i;

const PHONE_PATTERN = /(\+?\d[\d\s().-]{6,}\d)/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_PATTERN = /((?:https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}(?:\/[\w./%-]*)?)/i;
const POSTAL_CITY_PATTERN = /^\d{4,6}\s+[A-Za-zÀ-ÿ]/;

const COUNTRY_PATTERN =
  /^(norway|sweden|denmark|finland|germany|spain|france|netherlands|belgium|austria|switzerland|portugal|italy|poland|uk|united kingdom|usa|united states|canada|ireland)$/i;

const LABEL_ONLY_PATTERN =
  /^(role|title|position|job title|cargo|puesto|company|organization|organisation|empresa|mobile|mob|móvil|movil|cell|phone|tel|telephone|office|email|e-mail)\s*:?\s*$/i;

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

export function extractSignatureBlock(messageBody: string): string {
  const text = messageBody.includes("<") ? stripHtmlToText(messageBody) : messageBody;
  const normalized = text.replace(/\r/g, "");

  const dashSplit = normalized.split(/\n--\s*\n/);
  if (dashSplit.length > 1) {
    return dashSplit[dashSplit.length - 1]!.trim();
  }

  const underscoreSplit = normalized.split(/\n_{3,}\n/);
  if (underscoreSplit.length > 1) {
    return underscoreSplit[underscoreSplit.length - 1]!.trim();
  }

  const lines = normalizeLines(normalized);
  const signatureStart = lines.findIndex((line) =>
    /^(best regards|kind regards|regards|thanks|thank you|sincerely|cheers|saludos|atentamente)/i.test(
      line,
    ),
  );

  if (signatureStart >= 0 && signatureStart < lines.length - 1) {
    return lines.slice(signatureStart + 1).join("\n");
  }

  if (lines.length > 8) {
    return lines.slice(-12).join("\n");
  }

  return normalized.trim();
}

function labeledValue(line: string, labels: string[]): string | null {
  for (const label of labels) {
    const match = line.match(new RegExp(`^${label}\\s*[:\\-.]\\s*(.+)$`, "i"));
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function labeledValueOrNextLine(
  lines: string[],
  index: number,
  labels: string[],
): string | null {
  const line = lines[index]!;
  const inline = labeledValue(line, labels);
  if (inline) return inline;

  const isLabelOnly = labels.some((label) =>
    new RegExp(`^${label}\\s*:?\\s*$`, "i").test(line),
  );
  if (isLabelOnly) {
    const next = lines[index + 1]?.trim();
    return next || null;
  }

  return null;
}

function isLikelyPhoneValue(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

function isLikelyPhoneLine(line: string): boolean {
  return isLikelyPhoneValue(line);
}

function looksLikeRole(text: string): boolean {
  return TITLE_KEYWORDS.test(text);
}

function extractRoleCompanyFromLine(line: string): { role: string; company: string } | null {
  const match = line.trim().match(ROLE_COMPANY_PATTERN);
  if (!match?.[1] || !match[2]) return null;

  const role = match[1].trim();
  const company = match[2].trim();
  if (!role || !company || company.length > 100 || line.includes("@")) return null;
  if (!looksLikeRole(role)) return null;

  return { role, company };
}

function looksLikePersonNameStandalone(line: string): boolean {
  if (line.includes("@") || isLikelyPhoneLine(line)) return false;
  if (labeledValue(line, ["tel", "phone", "mobile", "mob", "email", "e-mail", "role", "title"])) {
    return false;
  }
  if (LABEL_ONLY_PATTERN.test(line)) return false;
  if (extractRoleCompanyFromLine(line) || looksLikeRole(line)) return false;
  if (WEBSITE_PATTERN.test(line)) return false;

  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 5 || line.length > 60) return false;

  return words.every((word) => /^[A-ZÀ-ÿ][\wÀ-ÿ.'-]*$/i.test(word));
}

function isLikelyPersonName(line: string): boolean {
  if (line.includes("@") || isLikelyPhoneLine(line)) return false;
  if (labeledValue(line, ["tel", "phone", "mobile", "mob", "email", "e-mail", "role", "title"])) {
    return false;
  }
  if (LABEL_ONLY_PATTERN.test(line)) return false;
  if (extractRoleCompanyFromLine(line) || looksLikeRole(line)) return false;
  if (looksLikeCompanyStandalone(line)) return false;
  if (WEBSITE_PATTERN.test(line)) return false;

  return looksLikePersonNameStandalone(line);
}

function looksLikeCompanyStandalone(line: string): boolean {
  if (line.includes("@") || isLikelyPhoneLine(line) || WEBSITE_PATTERN.test(line)) return false;
  if (looksLikeRole(line) || looksLikePersonNameStandalone(line)) return false;
  if (isAddressLine(line)) return false;
  if (line.length < 3 || line.length > 100) return false;

  const labeled = labeledValue(line, ["company", "organization", "organisation", "empresa"]);
  if (labeled) return true;

  return COMPANY_SUFFIX.test(line);
}

function isAddressLine(line: string): boolean {
  if (line.includes("@") || WEBSITE_PATTERN.test(line)) return false;
  if (labeledValue(line, ["phone", "tel", "telephone", "mobile", "mob", "email", "e-mail"])) {
    return false;
  }
  if (LABEL_ONLY_PATTERN.test(line)) return false;
  if (/^\d+\s+\S/.test(line)) return true;
  if (POSTAL_CITY_PATTERN.test(line)) return true;
  if (COUNTRY_PATTERN.test(line)) return true;
  if (/(gate|gata|straße|strasse|vei|veien|road|street|avenue|lane|way|platz)/i.test(line)) {
    return true;
  }
  return false;
}

function isConsumedFieldLine(line: string): boolean {
  if (line.includes("@") && EMAIL_PATTERN.test(line)) return true;
  if (WEBSITE_PATTERN.test(line)) return true;
  if (looksLikeRole(line) || looksLikeCompanyStandalone(line) || isLikelyPersonName(line)) {
    return true;
  }
  if (labeledValue(line, ["phone", "tel", "telephone", "mobile", "mob", "email", "e-mail"])) {
    return true;
  }
  if (LABEL_ONLY_PATTERN.test(line)) return true;
  if (isLikelyPhoneLine(line)) return true;
  return false;
}

function extractAddressAfterIndex(
  lines: string[],
  startIndex: number,
  consumed: Set<number>,
): string | null {
  const block: string[] = [];

  for (let i = startIndex + 1; i < lines.length && block.length < 4; i++) {
    if (consumed.has(i)) continue;

    const line = lines[i]!;
    if (isConsumedFieldLine(line) && block.length === 0) break;
    if (!isAddressLine(line) && block.length === 0) continue;
    if (!isAddressLine(line) && block.length > 0) break;

    block.push(line);
    consumed.add(i);
  }

  if (block.length >= 2) return block.join("\n");
  return null;
}

/** First-line person name when the signature block is structured. */
export function parseSignaturePersonName(
  messageBody: string,
  senderEmail?: string,
): string | null {
  if (!messageBody.trim()) return null;

  const lines = normalizeLines(extractSignatureBlock(messageBody));
  const first = lines[0];
  if (!first) return null;

  if (senderEmail && first.toLowerCase().includes(senderEmail.toLowerCase())) return null;
  if (!isLikelyPersonName(first)) return null;

  return first;
}

function orderedSuggestions(
  values: Partial<Record<SignatureFieldId, string>>,
): SignatureSuggestion[] {
  const labels: Record<SignatureFieldId, string> = {
    jobTitle: "Role",
    company: "Company",
    email: "Email",
    mobile: "Mobile",
    phone: "Phone",
    website: "Website",
    address: "Address",
  };

  return SUGGESTION_ORDER.flatMap((id) => {
    const value = values[id]?.trim();
    if (!value) return [];
    return [{ id, label: labels[id], value }];
  }).slice(0, MAX_SUGGESTIONS);
}

export function parseSignatureIntelligence(
  messageBody: string,
  senderEmail?: string,
): SignatureEnrichment {
  if (!messageBody.trim()) {
    return { suggestions: [] };
  }

  const block = extractSignatureBlock(messageBody);
  const lines = normalizeLines(block);
  const found: Partial<Record<SignatureFieldId, string>> = {};
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const roleLabel = labeledValueOrNextLine(lines, i, [
      "role",
      "title",
      "position",
      "job title",
      "cargo",
      "puesto",
    ]);
    if (roleLabel && !found.jobTitle) {
      const split = extractRoleCompanyFromLine(roleLabel);
      if (split) {
        found.jobTitle = split.role;
        if (!found.company) found.company = split.company;
      } else {
        found.jobTitle = roleLabel;
      }
      consumed.add(i);
      if (LABEL_ONLY_PATTERN.test(line)) consumed.add(i + 1);
    }

    const companyLabel = labeledValueOrNextLine(lines, i, [
      "company",
      "organization",
      "organisation",
      "empresa",
    ]);
    if (companyLabel && !found.company) {
      found.company = companyLabel;
      consumed.add(i);
      if (LABEL_ONLY_PATTERN.test(line)) consumed.add(i + 1);
    }

    const mobileLabel = labeledValueOrNextLine(lines, i, [
      "mobile",
      "mob",
      "móvil",
      "movil",
      "cell",
    ]);
    if (mobileLabel && isLikelyPhoneValue(mobileLabel) && !found.mobile) {
      found.mobile = normalizePhoneNumber(mobileLabel);
      consumed.add(i);
      if (LABEL_ONLY_PATTERN.test(line)) consumed.add(i + 1);
    }

    const phoneLabel = labeledValueOrNextLine(lines, i, [
      "phone",
      "tel",
      "telephone",
      "office",
    ]);
    if (phoneLabel && isLikelyPhoneValue(phoneLabel) && !found.phone) {
      found.phone = normalizePhoneNumber(phoneLabel);
      consumed.add(i);
      if (LABEL_ONLY_PATTERN.test(line)) consumed.add(i + 1);
    }

    const emailLabel = labeledValueOrNextLine(lines, i, ["email", "e-mail"]);
    if (emailLabel && EMAIL_PATTERN.test(emailLabel) && !found.email) {
      found.email = emailLabel.toLowerCase();
      consumed.add(i);
      if (LABEL_ONLY_PATTERN.test(line)) consumed.add(i + 1);
    }

    const roleCompany = extractRoleCompanyFromLine(line);
    if (roleCompany) {
      if (!found.jobTitle) found.jobTitle = roleCompany.role;
      if (!found.company) found.company = roleCompany.company;
      consumed.add(i);
      continue;
    }

    if (!found.phone && /^(tel|phone|telephone)\b/i.test(line)) {
      const match = line.match(PHONE_PATTERN);
      if (match?.[1]) {
        found.phone = normalizePhoneNumber(match[1]);
        consumed.add(i);
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i]!;

    if (!found.email && EMAIL_PATTERN.test(line)) {
      found.email = line.toLowerCase();
      consumed.add(i);
      continue;
    }

    const websiteMatch = line.match(WEBSITE_PATTERN);
    if (!found.website && websiteMatch?.[1]) {
      found.website = websiteMatch[1];
      consumed.add(i);
    }
  }

  if (!found.jobTitle) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i]!;
      if (
        line.length < 100 &&
        looksLikeRole(line) &&
        !isLikelyPhoneLine(line) &&
        !line.includes("@") &&
        !isLikelyPersonName(line)
      ) {
        const split = extractRoleCompanyFromLine(line);
        if (split) {
          found.jobTitle = split.role;
          if (!found.company) found.company = split.company;
        } else {
          found.jobTitle = line;
        }
        consumed.add(i);
        break;
      }
    }
  }

  if (!found.company) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i]!;
      if (!looksLikeCompanyStandalone(line)) continue;

      found.company = labeledValue(line, ["company", "organization", "organisation", "empresa"]) ?? line;
      consumed.add(i);

      if (!found.address) {
        const address = extractAddressAfterIndex(lines, i, consumed);
        if (address) found.address = address;
      }
      break;
    }
  }

  if (!found.address && found.company) {
    const companyIndex = lines.findIndex(
      (line) => line.trim() === found.company?.trim(),
    );
    if (companyIndex >= 0) {
      const address = extractAddressAfterIndex(lines, companyIndex, consumed);
      if (address) found.address = address;
    }
  }

  if (!found.phone) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i]!;
      if (line.includes("@") || found.mobile === normalizePhoneNumber(line)) continue;
      if (!isLikelyPhoneLine(line)) continue;
      const match = line.match(PHONE_PATTERN);
      if (match?.[1]) {
        found.phone = normalizePhoneNumber(match[1]);
        consumed.add(i);
        break;
      }
    }
  }

  if (found.email && senderEmail && found.email.toLowerCase() === senderEmail.toLowerCase()) {
    delete found.email;
  }

  if (senderEmail) {
    const emailLower = senderEmail.toLowerCase();
    for (const key of Object.keys(found) as SignatureFieldId[]) {
      const value = found[key];
      if (value && key !== "email" && value.toLowerCase().includes(emailLower)) {
        delete found[key];
      }
    }
  }

  return { suggestions: orderedSuggestions(found) };
}

export function parseSignatureAddress(address: string): {
  addressLine1: string;
  city: string;
} {
  const lines = address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const remaining = [...lines];

  if (remaining.length > 0 && COUNTRY_PATTERN.test(remaining[remaining.length - 1]!)) {
    remaining.pop();
  }

  let city = "";
  if (remaining.length > 0 && POSTAL_CITY_PATTERN.test(remaining[remaining.length - 1]!)) {
    const postalLine = remaining.pop()!;
    city = postalLine.replace(/^\d{4,6}\s*/, "").trim();
  }

  return {
    addressLine1: remaining.join("\n") || address.trim(),
    city,
  };
}

export function acceptedEnrichmentToContactFields(accepted: SignatureSuggestion[]): {
  jobTitle: string;
  mobile: string;
  phone: string;
  companyName: string;
  address: string;
  website: string;
} {
  const map = Object.fromEntries(accepted.map((item) => [item.id, item.value])) as Partial<
    Record<SignatureFieldId, string>
  >;

  return {
    jobTitle: map.jobTitle ?? "",
    mobile: normalizePhoneNumber(map.mobile ?? ""),
    phone: normalizePhoneNumber(map.phone ?? ""),
    companyName: map.company ?? "",
    address: map.address ?? "",
    website: map.website ?? "",
  };
}

export function websiteToDomain(website: string): string {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^(https?:\/\/)?(www\.)?/i, "").split("/")[0] ?? "";
  }
}
