import JSZip from "jszip";
import { isInternalEmail } from "@/lib/domain-rules";
import { normalizeCompanyName } from "@/lib/smartassist/explore/company-explore";

/** A person read from one spreadsheet row. Nothing is saved yet. */
export type SpreadsheetContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  companyPhone: string;
  jobTitle: string;
  honorific: string;
  department: string;
  role: string;
  companyName: string;
  linkedIn: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  country: string;
  website: string;
  notes: string;
};

export type CompanyMatchSource = {
  CompanyID: string;
  Title: string;
};

const MAX_ROWS = 300;

type Field = keyof SpreadsheetContact | "fullName";

/** Map a header by meaning, so "Mobile Phone" and "Company" both land. */
export function classifyHeader(raw: string): Field | null {
  const key = headerKey(raw);
  if (!key || key.includes("fax") || key.includes("source file") || key.includes("lead status")) {
    return null;
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
    jobTitle: "",
    honorific: "",
    department: "",
    role: "",
    companyName: "",
    linkedIn: "",
    streetAddress: "",
    postalCode: "",
    city: "",
    country: "",
    website: "",
    notes: "",
  };
}

export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]! };
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

/** Pull phone numbers out of a cell, including several numbers separated by / or |. */
export function extractPhoneNumbers(value: string): string[] {
  const pieces = value.split(/\s*(?:\/|\||;|\n|\band\b)\s*/i);
  const found: string[] = [];
  const push = (candidate: string) => {
    const cleaned = candidate
      .trim()
      .replace(/^(?:tel|tlf|phone|mob|mobile|fax|gsm|cell|handy|dir|direct)\.?\s*[:.]?\s*/i, "")
      .replace(/\s+/g, " ");
    const digits = digitRun(cleaned);
    if (digits.length < 8 || digits.length > 15) return;
    const letters = cleaned.replace(/ext\.?/gi, "").replace(/[+\d\s()./-]/g, "");
    if (letters.length > 0) return;
    if (!found.some((existing) => digitRun(existing) === digits)) found.push(cleaned);
  };

  for (const piece of pieces) push(piece);
  if (found.length === 0) {
    for (const match of value.matchAll(/\+\d[\d\s()./-]{6,}\d/g)) push(match[0] ?? "");
  }
  return found;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function looksLikeWebsite(value: string): boolean {
  const text = value.trim();
  if (looksLikeEmail(text) || /\s/.test(text)) return false;
  return /^(https?:\/\/|www\.)/i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(text);
}

function appendNote(record: SpreadsheetContact, line: string) {
  const next = line.trim();
  if (!next) return;
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
    if (!record.phone && !record.mobile) record.phone = number;
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
      const numbers = extractPhoneNumbers(value);
      if (kind || (numbers.length > 0 && !field)) {
        const phoneLabel = kind ?? "other";
        for (const number of numbers) {
          rememberPhone(record, phoneLabel, header, number, seenPhones);
        }
        if (numbers.length > 0) return;
      }
      if (field === "fullName") fullName = value;
      else if (field === "phone" || field === "mobile" || field === "companyPhone") {
        appendNote(record, `${header}: ${value}`);
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
): { id: string | null; ambiguous: boolean } {
  const key = normalizeCompanyName(name);
  if (!key) return { id: null, ambiguous: false };
  const hits = companies.filter((company) => normalizeCompanyName(company.Title) === key);
  if (hits.length === 1) return { id: hits[0]!.CompanyID, ambiguous: false };
  if (hits.length > 1) return { id: null, ambiguous: true };
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
  return lines;
}

/** Notes worth keeping on the person, in the order they were read. */
export function contactImportBackground(row: SpreadsheetContact, fileName: string): string {
  const lines: string[] = [];
  if (row.honorific.trim()) lines.push(row.honorific.trim());
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
