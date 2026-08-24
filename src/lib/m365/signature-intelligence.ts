/** Rule-based signature extraction — detected text only, no inference. */

import { isInternalEmail } from "@/lib/domain-rules";
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
  /\b(manager|director|engineer|officer|lead|head|vp|president|specialist|coordinator|supervisor|analyst|consultant|chief|executive|sponsor|procurement|compliance|founder|co-founder|cofounder|ceo|cto|cfo|coo|partner|owner|ambassador|director\s+general|marketing|prosjekt|prosjektleder|miljø|miljo|leder|sjef|ingeniør|ingenior|salgsingeniør|salgsingenior|markedsingeniør|markedsingenior|lagersjef|markedsfører|markedsforer|rådgiver|radgiver|direktør|direktor|daglig|salgssjef|markedssjef|salgsansvarlig|systemingeniør|systemingenior)\b|ansvarlig\b|\w*ingeni[øo]r\b/i;

const ROLE_COMPANY_PATTERN = /^(.+?)\s+(?:de|del|d'|at|@|for|en|bei|von)\s+(.+)$/i;

const COMPANY_SUFFIX =
  /\b(AS|ASA|AB|Oy|Ltd|Limited|Inc|Corp|GmbH|AG|SA|SRL|BV|PLC|Group|Co\.|Norge|Nordic)\b/i;

const PHONE_PATTERN = /(\+?\d[\d\s().-]{6,}\d)/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_PATTERN = /((?:https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}(?:\/[\w./%-]*)?)/i;
const BARE_DOMAIN_PATTERN = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i;
const MEETING_OR_APP_HOST =
  /(^|\.)(teams\.microsoft\.com|meet\.google\.com|zoom\.us|zoom\.com|outlook\.office\.com|outlook\.office365\.com|login\.microsoftonline\.com)$/i;

function isCompanyWebsite(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const host = new URL(url).hostname.toLowerCase();
    return !MEETING_OR_APP_HOST.test(host);
  } catch {
    return !/teams\.microsoft|meet\.google|zoom\.(us|com)/i.test(trimmed);
  }
}
const POSTAL_CITY_PATTERN = /^\d{4,6}\s+[A-Za-zÀ-ÿ]/;

const COUNTRY_PATTERN =
  /^(norway|sweden|denmark|finland|germany|spain|france|netherlands|belgium|austria|switzerland|portugal|italy|poland|uk|united kingdom|usa|united states|canada|ireland)$/i;

const LABEL_ONLY_PATTERN =
  /^(role|title|position|job title|stilling|stillingstittel|tittel|cargo|puesto|company|organization|organisation|empresa|mobile|mob|mobil|móvil|movil|cell|phone|tel|telephone|tlf|telefon|office|email|e-mail|e-post|epost)\s*:?\s*$/i;

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function collectHrefValues(html: string, scheme: "tel" | "mailto"): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`href=["']${scheme}:([^"'\\s]+)["']`, "gi");
  for (const match of html.matchAll(pattern)) {
    const raw = decodeURIComponent(match[1] ?? "").trim();
    if (raw) values.push(raw.replace(/^\/\//, ""));
  }
  return values;
}

export function stripHtmlToText(html: string): string {
  const telHrefs = collectHrefValues(html, "tel");

  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote|section)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const extras = telHrefs.join("\n");
  return extras ? `${text}\n${extras}` : text;
}

export function stripQuotedReply(text: string): string {
  const normalized = text.replace(/\r/g, "");
  const cutPatterns = [
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\n-{2,}\s*Opprinnelig melding\s*-{2,}/i,
    /\n-{2,}\s*Ursprüngliche Nachricht\s*-{2,}/i,
    /\nFrom:\s.+\nSent:\s/i,
    /\nFrån:\s.+\nSkickat:\s/i,
    /\nFra:\s.+\nSendt:\s/i,
    /\nOn .+ wrote:\s*$/im,
    /\nDen .+ skrev\s.+:\s*$/im,
  ];

  let earliest = -1;
  for (const pattern of cutPatterns) {
    const match = normalized.search(pattern);
    if (match >= 0 && (earliest < 0 || match < earliest)) {
      earliest = match;
    }
  }

  if (earliest > 40) {
    return normalized.slice(0, earliest).trim();
  }
  return normalized.trim();
}

function isMessageHeaderLine(line: string): boolean {
  return /^(from|to|cc|bcc|sent|date|subject|skickat|sendt|från|fra|till|til|ämne|emne)\s*:/i.test(
    line,
  );
}

export function extractSignatureBlock(messageBody: string, senderEmail?: string): string {
  const text = messageBody.includes("<") ? stripHtmlToText(messageBody) : messageBody;
  const normalized = stripQuotedReply(text.replace(/\r/g, ""));
  const lines = normalizeLines(normalized);

  const dashSplit = normalized.split(/\n--\s*\n/);
  if (dashSplit.length > 1) {
    return dashSplit[dashSplit.length - 1]!.trim();
  }

  const underscoreSplit = normalized.split(/\n_{3,}\n/);
  if (underscoreSplit.length > 1) {
    return underscoreSplit[underscoreSplit.length - 1]!.trim();
  }

  const signatureStart = lines.findIndex((line) =>
    /^(best regards|kind regards|regards|thanks|thank you|sincerely|cheers|saludos|atentamente|med vennlig hilsen|mvh|vennlig hilsen|med vänlig hälsning|vänliga hälsningar|hälsningar)\s*,?$/i.test(
      line,
    ),
  );

  if (signatureStart >= 0 && signatureStart < lines.length - 1) {
    return lines.slice(signatureStart + 1).join("\n");
  }

  const emailNeedle = senderEmail?.trim().toLowerCase();
  if (emailNeedle) {
    const emailIndex = lines.findIndex(
      (line) =>
        line.toLowerCase().includes(emailNeedle) && !isMessageHeaderLine(line),
    );
    if (emailIndex >= 0) {
      const from = Math.max(0, emailIndex - 6);
      return lines.slice(from, emailIndex + 8).join("\n");
    }
  }

  const phoneIndex = lines.findIndex((line) => isLikelyPhoneValue(line));
  if (phoneIndex >= 0) {
    const from = Math.max(0, phoneIndex - 8);
    return lines.slice(from, phoneIndex + 6).join("\n");
  }

  if (lines.length > 8) {
    return lines.slice(-16).join("\n");
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

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function isLikelyPhoneValue(value: string): boolean {
  const trimmed = value.trim();
  if (countDigits(trimmed) < 8) return false;
  if (/\b20\d{2}\b/.test(trimmed) && countDigits(trimmed) <= 8) return false;
  return PHONE_PATTERN.test(trimmed);
}

function extractPhoneFromLine(line: string): string | null {
  if (line.includes("@")) return null;
  const match = line.match(PHONE_PATTERN);
  if (match?.[1] && isLikelyPhoneValue(match[1])) {
    return normalizePhoneNumber(match[1]);
  }
  if (isLikelyPhoneValue(line)) {
    return normalizePhoneNumber(line);
  }
  return null;
}

function isLikelyPhoneLine(line: string): boolean {
  return extractPhoneFromLine(line) !== null;
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
  if (labeledValue(line, ["tel", "phone", "mobile", "mob", "mobil", "email", "e-mail", "e-post", "epost", "role", "title"])) {
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
  if (labeledValue(line, ["tel", "phone", "mobile", "mob", "mobil", "email", "e-mail", "e-post", "epost", "role", "title"])) {
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
  if (isAddressLine(line)) return false;
  if (line.length < 3 || line.length > 100) return false;

  const labeled = labeledValue(line, ["company", "organization", "organisation", "empresa"]);
  if (labeled) return true;

  // Legal suffix wins over person-name heuristics ("Ottem Resirk AS").
  if (COMPANY_SUFFIX.test(line)) return true;

  if (looksLikeRole(line) || looksLikePersonNameStandalone(line)) return false;

  return false;
}

function isAddressLine(line: string): boolean {
  if (line.includes("@") || WEBSITE_PATTERN.test(line)) return false;
  if (labeledValue(line, ["phone", "tel", "telephone", "mobile", "mob", "mobil", "email", "e-mail", "e-post", "epost"])) {
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
  if (labeledValue(line, ["phone", "tel", "telephone", "mobile", "mob", "mobil", "email", "e-mail", "e-post", "epost"])) {
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

  if (block.length >= 1) return block.join("\n");
  return null;
}

/** First-line person name when the signature block is structured. */
export function parseSignaturePersonName(
  messageBody: string,
  senderEmail?: string,
): string | null {
  if (!messageBody.trim()) return null;

  const lines = normalizeLines(extractSignatureBlock(messageBody, senderEmail));
  const first = lines[0];
  if (!first) return null;

  if (senderEmail && first.toLowerCase().includes(senderEmail.toLowerCase())) return null;
  if (!isLikelyPersonName(first)) {
    const stripped = first.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (stripped !== first && isLikelyPersonName(stripped)) return stripped;
    return null;
  }

  return first.replace(/\s*\([^)]*\)\s*$/, "").trim() || first;
}

function orderedSuggestions(
  values: Partial<Record<SignatureFieldId, string>>,
): SignatureSuggestion[] {
  const labels: Record<SignatureFieldId, string> = {
    jobTitle: "Position",
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

  const block = extractSignatureBlock(messageBody, senderEmail);
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
      "stilling",
      "stillingstittel",
      "tittel",
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
      "mobil",
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
      "tlf",
      "telefon",
      "t",
    ]);
    if (phoneLabel && isLikelyPhoneValue(phoneLabel) && !found.phone) {
      found.phone = normalizePhoneNumber(phoneLabel);
      consumed.add(i);
      if (LABEL_ONLY_PATTERN.test(line)) consumed.add(i + 1);
    }

    const mobileShort = labeledValueOrNextLine(lines, i, ["m"]);
    if (mobileShort && isLikelyPhoneValue(mobileShort) && !found.mobile) {
      found.mobile = normalizePhoneNumber(mobileShort);
      consumed.add(i);
    }

    const emailLabel = labeledValueOrNextLine(lines, i, [
      "email",
      "e-mail",
      "e-post",
      "epost",
      "mail",
    ]);
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
    if (!found.email) {
      const embeddedEmail = line.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      if (embeddedEmail?.[0]) {
        found.email = embeddedEmail[0].toLowerCase();
        consumed.add(i);
        continue;
      }
    }

    const websiteMatch = line.match(WEBSITE_PATTERN);
    if (!found.website && websiteMatch?.[1] && isCompanyWebsite(websiteMatch[1])) {
      found.website = websiteMatch[1];
      consumed.add(i);
      continue;
    }

    if (
      !found.website &&
      BARE_DOMAIN_PATTERN.test(line) &&
      !line.includes("@") &&
      isCompanyWebsite(line)
    ) {
      found.website = line.replace(/^https?:\/\//i, "");
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

  // Structural: Name / Job title / Company AS — capture middle line as title.
  if (!found.jobTitle) {
    const nameIndex = lines.findIndex((line, index) => {
      if (consumed.has(index)) return false;
      return isLikelyPersonName(line);
    });
    const companyIndex = found.company
      ? lines.findIndex((line) => line.trim() === found.company?.trim())
      : lines.findIndex((line, index) => {
          if (consumed.has(index)) return false;
          return looksLikeCompanyStandalone(line);
        });
    if (
      nameIndex >= 0 &&
      companyIndex > nameIndex + 1 &&
      companyIndex - nameIndex <= 3
    ) {
      for (let i = nameIndex + 1; i < companyIndex; i++) {
        if (consumed.has(i)) continue;
        const line = lines[i]!;
        if (
          isLikelyPhoneLine(line) ||
          line.includes("@") ||
          WEBSITE_PATTERN.test(line) ||
          isAddressLine(line) ||
          looksLikeCompanyStandalone(line)
        ) {
          continue;
        }
        if (line.length > 2 && line.length < 100) {
          found.jobTitle = line;
          consumed.add(i);
          break;
        }
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
      const extracted = extractPhoneFromLine(line);
      if (!extracted || found.mobile === extracted) continue;
      found.phone = extracted;
      consumed.add(i);
      break;
    }
  }

  if (!found.jobTitle || (!found.phone && !found.mobile)) {
    const fullText = messageBody.includes("<") ? stripHtmlToText(messageBody) : messageBody;
    const allLines = normalizeLines(fullText);
    for (const line of allLines) {
      if (!found.jobTitle && looksLikeRole(line) && !line.includes("@") && line.length < 100) {
        const split = extractRoleCompanyFromLine(line);
        found.jobTitle = split?.role ?? line;
        if (split && !found.company) found.company = split.company;
      }
      if (!found.phone && !found.mobile) {
        const extracted = extractPhoneFromLine(line);
        if (extracted) found.phone = extracted;
      }
      if (
        !found.website &&
        BARE_DOMAIN_PATTERN.test(line) &&
        !line.includes("@") &&
        isCompanyWebsite(line)
      ) {
        found.website = line.replace(/^https?:\/\//i, "");
      }
    }
  }

  if (senderEmail) {
    delete found.email;
  }

  if (senderEmail && !isInternalEmail(senderEmail)) {
    if (found.email && isInternalEmail(found.email)) {
      delete found.email;
    }
    if (found.website && hostLooksInternal(found.website)) {
      delete found.website;
    }
    if (found.company && /standard\s*bio/i.test(found.company)) {
      delete found.company;
    }
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

function hostLooksInternal(value: string): boolean {
  try {
    const url = value.trim().startsWith("http") ? value.trim() : `https://${value.trim()}`;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return isInternalEmail(`probe@${host}`);
  } catch {
    return /standard\.bio|standardbio\.(com|no)/i.test(value);
  }
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
