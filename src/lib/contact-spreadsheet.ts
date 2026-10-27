import JSZip from "jszip";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { isInternalEmail } from "@/lib/domain-rules";
import { findCountryEntry } from "@/lib/geo/country-continent";
import { normalizeCompanyName } from "@/lib/smartassist/explore/company-explore";
import { suggestContactListRoleFromTitle } from "@/types/contact";

/** A person read from one spreadsheet row. Nothing is saved yet. */
export type SpreadsheetContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  companyPhone: string;
  companyEmail: string;
  jobTitle: string;
  honorific: string;
  department: string;
  role: string;
  companyName: string;
  companyAlternativeName: string;
  linkedIn: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  country: string;
  website: string;
  notes: string;
  sourceFile: string;
};

export type CompanyMatchSource = {
  CompanyID: string;
  Title: string;
  Domain?: string;
};

const MAX_ROWS = 300;

type Field = keyof SpreadsheetContact | "fullName";

/** Map a header by meaning, so "Mobile Phone" and "Company" both land. */
export function classifyHeader(raw: string): Field | null {
  const key = headerKey(raw);
  if (!key || key.includes("fax") || key.includes("lead status")) {
    return null;
  }
  if (key === "file" || key.includes("source file") || key === "filename" || key === "file name") {
    return "sourceFile";
  }
  if (
    key.includes("mobile") ||
    key.includes("mobil") ||
    key.includes("gsm") ||
    key.includes("cell") ||
    key.includes("handy")
  ) {
    return "mobile";
  }
  if (
    key.includes("company") &&
    (key.includes("phone") || key.includes("tel") || key.includes("tlf"))
  ) {
    return "companyPhone";
  }
  if (key.includes("phone") || key.includes("tel") || key.includes("telefon") || key.includes("tlf")) {
    return "phone";
  }
  if (
    key.includes("company") &&
    (key.includes("email") || key.includes("e mail") || key.includes("mail") || key.includes("epost"))
  ) {
    return "companyEmail";
  }
  if (
    key.includes("email") ||
    key.includes("e mail") ||
    key.includes("e post") ||
    key === "mail" ||
    key.includes("epost")
  ) {
    return "email";
  }
  if (
    key.includes("website") ||
    key.includes("web site") ||
    key.includes("hjemmeside") ||
    key.includes("nettside") ||
    key === "url" ||
    key === "web"
  ) {
    return "website";
  }
  if (key.includes("linkedin")) return "linkedIn";
  if (key.includes("first") || key.includes("fornavn") || key.includes("given name")) return "firstName";
  if (key.includes("last") || key.includes("surname") || key.includes("etternavn")) return "lastName";
  if (key.includes("full name") || key === "name" || key === "navn") return "fullName";
  if (key.includes("honorific") || key.includes("academic")) return "honorific";
  if (key.includes("job") || key === "title" || key.includes("stilling") || key.includes("position")) {
    return "jobTitle";
  }
  if (key.includes("department") || key.includes("division")) return "department";
  if (key.includes("street") || key.includes("address")) return "streetAddress";
  if (
    key.includes("postal") ||
    key.includes("zip") ||
    key.includes("postcode") ||
    key.includes("post code") ||
    key.includes("postnr")
  ) {
    return "postalCode";
  }
  if (key === "city" || key.includes("city") || key === "sted") return "city";
  if (key === "country" || key === "land" || key.includes("country")) return "country";
  if (key.includes("note")) return "notes";
  if (key.includes("company") || key.includes("firma") || key.includes("organis")) return "companyName";
  if (key.includes("role") || key.includes("rolle")) return "role";
  return null;
}

function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ");
}

function emptyContact(): SpreadsheetContact {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    companyPhone: "",
    companyEmail: "",
    jobTitle: "",
    honorific: "",
    department: "",
    role: "",
    companyName: "",
    companyAlternativeName: "",
    linkedIn: "",
    streetAddress: "",
    postalCode: "",
    city: "",
    country: "",
    website: "",
    notes: "",
    sourceFile: "",
  };
}

const NAME_HONORIFIC_PREFIX = /^(?:(?:dr|prof|mr|mrs|ms|ing|dipl)\.?\s+)+/i;

export function splitPersonName(full: string): {
  firstName: string;
  lastName: string;
  honorific?: string;
} {
  const raw = full.trim();
  if (!raw) return { firstName: "", lastName: "" };
  const prefixMatch = raw.match(NAME_HONORIFIC_PREFIX);
  const honorific = prefixMatch ? prefixMatch[0].trim() : "";
  const stripped = (prefixMatch ? raw.slice(prefixMatch[0].length) : raw).trim();
  const parts = (stripped || raw).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: "", ...(honorific ? { honorific } : {}) };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]!,
    ...(honorific ? { honorific } : {}),
  };
}

function detectDelimiter(text: string): string {
  const line = text.split("\n")[0] ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "," || ch === ";" || ch === "\t")) counts[ch] += 1;
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

/** Parse CSV, semicolon-separated Excel exports, or tab-separated text. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.length > 0));
}

function digitRun(value: string): string {
  return value.replace(/\D/g, "");
}

type LabeledPhone = {
  kind: PhoneKind;
  number: string;
};

function classifyPhonePieceKind(piece: string, fallback: PhoneKind): PhoneKind {
  const prefix = piece.trim().toLowerCase();
  if (/^(?:mobile|mobil|mob|gsm|cell|handy)\b/.test(prefix)) return "mobile";
  if (/^(?:direkte|direct|direkt|dir)\b/.test(prefix)) return "direct";
  if (/^(?:telefax|fax|f)\b\s*[:.]/.test(prefix) || /^(?:telefax|fax)\b/.test(prefix)) return "fax";
  if (
    /^(?:telefon|telephone|téléphone|tel|tél|tlf|tfn|phone)\b/.test(prefix) ||
    /^(?:p|\(o\))\s*[:.]/.test(prefix)
  ) {
    return fallback === "mobile" || fallback === "fax" ? fallback : "company";
  }
  return fallback;
}

/** Pull phone numbers out of a cell, including several numbers separated by commas, /, or |. */
export function extractLabeledPhones(value: string, fallback: PhoneKind = "other"): LabeledPhone[] {
  const pieces = value.split(/\s*(?:\/|\||;|,|\n|\band\b)\s*/i);
  const found: LabeledPhone[] = [];
  const push = (candidate: string, defaultKind: PhoneKind) => {
    const kind = classifyPhonePieceKind(candidate, defaultKind);
    const cleaned = candidate
      .trim()
      .replace(
        /^(?:(?:telefon|telephone|téléphone|telefax|direkte|direct|direkt|mobile|mobil|phone|handy|cell|tél|tel|tlf|tfn|mob|fax|gsm|dir|p|f|\(o\))\.?(?:\s+[A-Za-zÀ-ÿ]+)?)\s*[:.]?\s*/i,
        "",
      )
      .replace(/\s+ext\.?\s*\d+$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const digits = digitRun(cleaned);
    if (digits.length < 7 || digits.length > 15) return;
    const letters = cleaned.replace(/ext\.?/gi, "").replace(/[+\d\s()./-]/g, "");
    if (letters.length > 0) return;
    if (!found.some((existing) => digitRun(existing.number) === digits)) {
      found.push({ kind, number: cleaned });
    }
  };

  for (const piece of pieces) push(piece, fallback);
  if (found.length === 0) {
    for (const match of value.matchAll(/\+\d[\d\s()./-]{6,}\d/g)) {
      push(match[0] ?? "", fallback);
    }
  }
  return found;
}

export function extractPhoneNumbers(value: string): string[] {
  return extractLabeledPhones(value).map((entry) => entry.number);
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function extractEmails(value: string): string[] {
  const matches = value.match(/[^\s@,;/:]+@[^\s@,;/:]+\.[^\s@,;/:]+/g) ?? [];
  const unique: string[] = [];
  for (const match of matches) {
    const clean = match.replace(/[.,;)]+$/, "").trim();
    if (looksLikeEmail(clean) && !unique.some((e) => e.toLowerCase() === clean.toLowerCase())) {
      unique.push(clean);
    }
  }
  return unique;
}

function looksLikeWebsite(value: string): boolean {
  const text = value.trim();
  if (looksLikeEmail(text) || /\s/.test(text)) return false;
  return /^(https?:\/\/|www\.)/i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(text);
}

function splitWebsiteField(value: string): { primary: string; extras: string[] } {
  const parts = value
    .split(/\s*(?:\/|\||;|,|\s+)\s*/)
    .map((part) => part.trim())
    .filter((part) => looksLikeWebsite(part));
  if (parts.length === 0) return { primary: value.trim(), extras: [] };
  return { primary: parts[0]!, extras: parts.slice(1) };
}

export function parseStructuredAddress(raw: string): {
  streetAddress: string;
  postalCode: string;
  city: string;
  country: string;
} {
  const cleaned = raw.trim();
  if (!cleaned) return { streetAddress: "", postalCode: "", city: "", country: "" };

  // Extract trailing country from the full string first (in case of "Addr 1 / Addr 2, Country")
  let trailingCountry = "";
  const fullTokens = cleaned.split(/\s*(?:,|\n|\s+-\s+)\s*/).filter(Boolean);
  if (fullTokens.length > 0) {
    const lastFull = findCountryEntry(fullTokens[fullTokens.length - 1]!);
    if (lastFull) trailingCountry = lastFull.name;
  }

  const primaryBlock = cleaned.split(/\s+\/\s+/)[0]?.trim() || cleaned;
  const rawTokens = primaryBlock
    .split(/\s*(?:,|\n|\s+-\s+)\s*/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (rawTokens.length === 0) {
    return { streetAddress: cleaned, postalCode: "", city: "", country: trailingCountry };
  }

  let country = "";
  const lastToken = rawTokens[rawTokens.length - 1]!;
  const resolvedLastCountry = findCountryEntry(lastToken);
  if (resolvedLastCountry) {
    country = resolvedLastCountry.name;
    rawTokens.pop();
  } else if (trailingCountry) {
    country = trailingCountry;
  }

  let postalCode = "";
  let city = "";

  for (let i = rawTokens.length - 1; i >= 0; i--) {
    const token = rawTokens[i]!;
    const prefixPostal = token.match(
      /^((?:[A-Z]{1,2}-\s*)?\d{3,6}(?:\s?\d{2})?)\s+(.+)$/i,
    );
    if (prefixPostal && /[A-Za-zÀ-ÿ]/.test(prefixPostal[2] ?? "")) {
      postalCode = prefixPostal[1]!.replace(/\s+/g, " ").trim();
      city = prefixPostal[2]!.trim();
      rawTokens.splice(i, 1);
      break;
    }
    const suffixPostal = token.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.-]+?)[-\s]+(\d{4,6})$/);
    if (suffixPostal) {
      city = suffixPostal[1]!.trim();
      postalCode = suffixPostal[2]!.trim();
      rawTokens.splice(i, 1);
      break;
    }
  }

  if (!city && rawTokens.length > 0) {
    const candidate = rawTokens[rawTokens.length - 1]!;
    if (
      country &&
      rawTokens.length === 1 &&
      !/\d/.test(candidate) &&
      candidate.length <= 40
    ) {
      city = candidate;
      rawTokens.pop();
    } else if (
      country &&
      rawTokens.length >= 2 &&
      !/\d/.test(candidate) &&
      !/^(?:p\.?o\.?\s*box|postboks|pb\.?)/i.test(candidate)
    ) {
      city = candidate;
      rawTokens.pop();
    }
  }

  return {
    streetAddress: rawTokens.join(", "),
    postalCode,
    city,
    country,
  };
}

const GENERIC_COMPANY_EMAIL_LOCAL = /^(?:post|mail|info|kontakt|contact|office|firmapost|admin|hello|support)$/i;

function splitCompanyDisplayAndAlias(raw: string): {
  companyName: string;
  companyAlternativeName: string;
  departmentHint: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { companyName: "", companyAlternativeName: "", departmentHint: "" };

  const parenMatch = trimmed.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (parenMatch) {
    const main = parenMatch[1]!.trim();
    const inside = parenMatch[2]!.trim();
    if (/^(?:fakultet|faculty|dept|department|institutt|division|subsea|miljø|teknisk)/i.test(inside)) {
      return { companyName: main, companyAlternativeName: "", departmentHint: inside };
    }
    return { companyName: main, companyAlternativeName: inside, departmentHint: "" };
  }

  const dashMatch = trimmed.match(/^(.+?)\s+-\s+([A-ZÆØÅ0-9]{2,12})$/);
  if (dashMatch) {
    return {
      companyName: dashMatch[1]!.trim(),
      companyAlternativeName: dashMatch[2]!.trim(),
      departmentHint: "",
    };
  }

  return { companyName: trimmed, companyAlternativeName: "", departmentHint: "" };
}

const CREDENTIAL_PARENS =
  /\s*\(((?:.*?\b(?:dr\.?|ph\.?d\.?|m\.?sc\.?|b\.?sc\.?|dipl\.?\s*ing\.?|csci|fimmm|frms|mrsc|michem|scient|hons)\b.*))\)\s*$/i;

function extractHonorificFromJobTitle(rawTitle: string): {
  jobTitle: string;
  honorific: string;
} {
  const trimmed = rawTitle.trim();
  const match = trimmed.match(CREDENTIAL_PARENS);
  if (!match) return { jobTitle: trimmed, honorific: "" };
  return {
    jobTitle: trimmed.slice(0, match.index).replace(/[,\s]+$/, "").trim(),
    honorific: match[1]!.trim(),
  };
}

function appendNote(record: SpreadsheetContact, line: string) {
  const next = line.trim();
  if (!next) return;
  const existingLines = record.notes.split("\n").map((item) => item.trim().toLowerCase());
  if (existingLines.includes(next.toLowerCase())) return;
  record.notes = record.notes ? `${record.notes}\n${next}` : next;
}

type PhoneKind = "mobile" | "direct" | "company" | "fax" | "other";

function phoneKind(header: string, field: Field | null): PhoneKind | null {
  const key = headerKey(header);
  if (field === "mobile" || key.includes("gsm") || key.includes("cell") || key.includes("handy")) {
    return "mobile";
  }
  if (key.includes("fax")) return "fax";
  if (field === "companyPhone") return "company";
  if (field === "phone" || key.includes("tlf") || key.includes("telefon")) return "direct";
  return null;
}

function rememberPhone(
  record: SpreadsheetContact,
  kind: PhoneKind,
  label: string,
  number: string,
  seen: Set<string>,
) {
  const digits = digitRun(number);
  if (seen.has(digits)) return;
  seen.add(digits);
  if (kind === "mobile" && !record.mobile) {
    record.mobile = number;
    return;
  }
  if (kind === "direct" && !record.phone) {
    record.phone = number;
    return;
  }
  if (kind === "company" && !record.companyPhone) {
    record.companyPhone = number;
    return;
  }
  if (kind === "fax") {
    appendNote(record, `Fax: ${number}`);
    return;
  }
  if (kind === "other" && !record.phone) {
    record.phone = number;
    return;
  }
  const name =
    kind === "mobile" ? "Mobile" : kind === "direct" ? "Direct phone" : kind === "company" ? "Company phone" : label;
  appendNote(record, `${name}: ${number}`);
}

function isNoiseHeader(header: string): boolean {
  const key = headerKey(header);
  return !key || key.includes("lead status");
}

export function contactsFromGrid(grid: string[][]): {
  contacts: SpreadsheetContact[];
  error: string | null;
} {
  if (grid.length === 0) return { contacts: [], error: "This file has no rows." };

  const fields = grid[0]!.map((cell) => classifyHeader(cell));
  const hasName = fields.some(
    (field) => field === "firstName" || field === "lastName" || field === "fullName",
  );
  if (!hasName) {
    return {
      contacts: [],
      error: "Add a Name column, or First name and Last name.",
    };
  }

  const contacts: SpreadsheetContact[] = [];
  for (const source of grid.slice(1)) {
    if (contacts.length >= MAX_ROWS) break;
    const record = emptyContact();
    const seenPhones = new Set<string>();
    let fullName = "";
    fields.forEach((field, index) => {
      const value = source[index]?.trim() ?? "";
      if (!value) return;
      const header = grid[0]?.[index]?.trim() || "Detail";
      const kind = phoneKind(header, field);
      const labeledPhones = extractLabeledPhones(value, kind ?? "other");
      if (kind || (labeledPhones.length > 0 && !field)) {
        for (const entry of labeledPhones) {
          rememberPhone(record, entry.kind, header, entry.number, seenPhones);
        }
        if (!record.phone && !record.mobile && record.companyPhone) {
          record.phone = record.companyPhone;
        }
        if (labeledPhones.length > 0) return;
      }
      if (field === "fullName") {
        fullName = value;
      } else if (field === "phone" || field === "mobile" || field === "companyPhone") {
        appendNote(record, `${header}: ${value}`);
      } else if (field === "email") {
        const emails = extractEmails(value);
        if (emails.length > 0) {
          record.email = emails[0]!;
          for (const extra of emails.slice(1)) {
            appendNote(record, `Secondary email: ${extra}`);
          }
        } else if (!record.email) {
          record.email = value;
        }
      } else if (field === "website") {
        const splitWeb = splitWebsiteField(value);
        if (!record.website) record.website = splitWeb.primary;
        for (const extra of splitWeb.extras) {
          appendNote(record, `Alternative website: ${extra}`);
        }
      } else if (field === "notes") {
        const emailsInNote = extractEmails(value);
        const noteEmail = emailsInNote[0];
        const noteLocal = noteEmail?.split("@")[0]?.toLowerCase() ?? "";
        const noteDomainBase = noteEmail?.split("@")[1]?.split(".")[0]?.toLowerCase() ?? "";
        if (
          emailsInNote.length === 1 &&
          noteEmail &&
          !record.companyEmail &&
          (GENERIC_COMPANY_EMAIL_LOCAL.test(noteLocal) ||
            (noteLocal && noteLocal === noteDomainBase) ||
            /general\s+email/i.test(value))
        ) {
          record.companyEmail = noteEmail;
        } else {
          appendNote(record, value);
        }
      } else if (field) {
        if (!record[field]) record[field] = value;
      } else if (isNoiseHeader(header)) {
        return;
      } else if (looksLikeEmail(value) && !record.email) {
        record.email = value;
      } else if (looksLikeWebsite(value) && !record.website) {
        record.website = value;
      } else {
        appendNote(record, `${header}: ${value}`);
      }
    });

    if (fullName) {
      const split = splitPersonName(fullName);
      if (!record.firstName) record.firstName = split.firstName;
      if (!record.lastName) record.lastName = split.lastName;
      if (split.honorific && !record.honorific) record.honorific = split.honorific;
    }

    if (record.jobTitle) {
      const extracted = extractHonorificFromJobTitle(record.jobTitle);
      record.jobTitle = extracted.jobTitle;
      if (extracted.honorific) {
        record.honorific = record.honorific
          ? `${record.honorific}, ${extracted.honorific}`
          : extracted.honorific;
      }
    }

    if (record.companyName) {
      const splitComp = splitCompanyDisplayAndAlias(record.companyName);
      record.companyName = splitComp.companyName;
      if (splitComp.companyAlternativeName && !record.companyAlternativeName) {
        record.companyAlternativeName = splitComp.companyAlternativeName;
      }
      if (splitComp.departmentHint && !record.department) {
        record.department = splitComp.departmentHint;
      }
    }

    if (
      record.streetAddress &&
      !record.postalCode &&
      !record.city &&
      !record.country
    ) {
      const parsedAddr = parseStructuredAddress(record.streetAddress);
      if (parsedAddr.postalCode || parsedAddr.city || parsedAddr.country) {
        record.streetAddress = parsedAddr.streetAddress;
        if (parsedAddr.postalCode) record.postalCode = parsedAddr.postalCode;
        if (parsedAddr.city) record.city = parsedAddr.city;
        if (parsedAddr.country) record.country = parsedAddr.country;
      }
    }

    if (!record.role && record.jobTitle) {
      const suggestedRole = suggestContactListRoleFromTitle(record.jobTitle);
      if (suggestedRole) record.role = suggestedRole;
    }

    const blank =
      !record.firstName &&
      !record.lastName &&
      !record.email &&
      !record.companyName &&
      !record.phone &&
      !record.mobile;
    if (!blank) contacts.push(record);
  }

  if (contacts.length === 0) {
    return { contacts: [], error: "No people were found under that header." };
  }
  if (grid.length - 1 > MAX_ROWS) {
    return {
      contacts,
      error: `Showing the first ${MAX_ROWS} people. Split the file to add the rest.`,
    };
  }
  return { contacts, error: null };
}

export function matchCompanyId(
  name: string,
  companies: CompanyMatchSource[],
  websiteOrDomain?: string,
): { id: string | null; ambiguous: boolean } {
  const key = normalizeCompanyName(name);
  if (key) {
    const hits = companies.filter((company) => normalizeCompanyName(company.Title) === key);
    if (hits.length === 1) return { id: hits[0]!.CompanyID, ambiguous: false };
    if (hits.length > 1) return { id: null, ambiguous: true };
  }
  const domain = websiteOrDomain ? normalizeCompanyDomain(websiteOrDomain) : "";
  if (domain) {
    const domainHits = companies.filter(
      (company) => company.Domain && normalizeCompanyDomain(company.Domain) === domain,
    );
    if (domainHits.length === 1) return { id: domainHits[0]!.CompanyID, ambiguous: false };
    if (domainHits.length > 1) return { id: null, ambiguous: true };
  }
  return { id: null, ambiguous: false };
}

export function contactImportNote(
  row: SpreadsheetContact & { companyId: string | null },
  existingEmails: Set<string>,
  ambiguousCompany: boolean,
): string | null {
  if (!row.firstName.trim() || !row.lastName.trim()) return "First and last name are required.";
  if (isInternalEmail(row.email)) {
    return "This is a Standard Bio colleague. Add them in Users & Access.";
  }
  const email = row.email.trim().toLowerCase();
  if (email && existingEmails.has(email)) return "Already in SmartCRM.";
  if (ambiguousCompany && !row.companyId) {
    return "More than one company has this name. Pick the right one.";
  }
  if (!row.companyId && !row.companyName.trim()) return "No company on this row.";
  return null;
}

/** Everything we read, so the preview shows more than the first phone. */
export function contactDetailLines(row: SpreadsheetContact): string[] {
  const lines: string[] = [];
  if (row.jobTitle.trim()) lines.push(row.jobTitle.trim());
  if (row.honorific.trim()) lines.push(row.honorific.trim());
  if (row.department.trim()) lines.push(row.department.trim());
  const seen = new Set<string>();
  const phones: Array<[string, string]> = [
    ["Mobile", row.mobile],
    ["Direct", row.phone],
    ["Company", row.companyPhone],
  ];
  for (const [label, number] of phones) {
    const digits = digitRun(number);
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    lines.push(`${label} ${number.trim()}`);
  }
  for (const line of row.notes.split("\n")) {
    if (line.trim()) lines.push(line.trim());
  }
  const address = [row.streetAddress, row.postalCode, row.city, row.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  if (address) lines.push(address);
  if (row.website.trim()) lines.push(row.website.trim());
  if (row.companyEmail.trim()) lines.push(`Company email: ${row.companyEmail.trim()}`);
  if (row.sourceFile.trim()) lines.push(`Source card: ${row.sourceFile.trim()}`);
  return lines;
}

/** Notes worth keeping on the person, in the order they were read. */
export function contactImportBackground(row: SpreadsheetContact, fileName: string): string {
  const lines: string[] = [];
  if (row.honorific.trim()) lines.push(`Honorific: ${row.honorific.trim()}`);
  if (row.department.trim()) lines.push(`Department: ${row.department.trim()}`);
  const companyDigits = digitRun(row.companyPhone);
  if (
    companyDigits &&
    companyDigits !== digitRun(row.phone) &&
    companyDigits !== digitRun(row.mobile)
  ) {
    lines.push(`Company phone: ${row.companyPhone.trim()}`);
  }
  if (row.notes.trim()) lines.push(row.notes.trim());
  if (row.sourceFile.trim()) lines.push(`Business card file: ${row.sourceFile.trim()}`);
  if (fileName.trim()) lines.push(`Imported from ${fileName.trim()}`);
  return lines.join("\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "");
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return index - 1;
}

function rowIndex(ref: string): number {
  return Number(ref.replace(/[A-Za-z]/g, "")) - 1;
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [];
  const xml = await file.async("string");
  const strings: string[] = [];
  for (const block of xml.split(/<si\b[^>]*>/i).slice(1)) {
    const parts = [...block.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((match) =>
      decodeXml(match[1] ?? ""),
    );
    strings.push(parts.join(""));
  }
  return strings;
}

function sheetToGrid(xml: string, shared: string[]): string[][] {
  const rows = new Map<number, string[]>();
  const cells = xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi);
  for (const cell of cells) {
    const attrs = cell[1] ?? "";
    const inner = cell[2] ?? "";
    const ref = /r="([A-Za-z]+[0-9]+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
    let value = "";
    if (type === "inlineStr") {
      value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((match) => decodeXml(match[1] ?? ""))
        .join("");
    } else if (type === "s") {
      const index = Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
      value = shared[index] ?? "";
    } else if (type !== "e") {
      value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
    }
    const r = rowIndex(ref);
    const c = columnIndex(ref);
    if (r < 0 || c < 0) continue;
    const line = rows.get(r) ?? [];
    line[c] = value.trim();
    rows.set(r, line);
  }

  const indexes = [...rows.keys()].sort((a, b) => a - b);
  return indexes.map((index) => {
    const line = rows.get(index) ?? [];
    return Array.from({ length: line.length }, (_, column) => line[column] ?? "");
  });
}

export async function readXlsxGrid(buffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const sheet =
    zip.file("xl/worksheets/sheet1.xml") ??
    zip.file(/xl\/worksheets\/sheet[^/]+\.xml$/i)[0] ??
    null;
  if (!sheet) throw new Error("This Excel file has no sheet to read.");
  const xml = await sheet.async("string");
  const shared = await readSharedStrings(zip);
  return sheetToGrid(xml, shared);
}

export async function readSpreadsheetGrid(name: string, buffer: ArrayBuffer): Promise<string[][]> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseDelimited(new TextDecoder("utf-8").decode(buffer));
  }
  if (lower.endsWith(".xlsx")) return readXlsxGrid(buffer);
  if (lower.endsWith(".xls")) {
    throw new Error("Save the file as Excel (.xlsx) or CSV, then upload it again.");
  }
  throw new Error("Use an Excel file (.xlsx) or a CSV file.");
}
