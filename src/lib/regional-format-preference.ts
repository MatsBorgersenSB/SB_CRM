export const DATE_FORMAT_STORAGE_KEY = "smartcrm-date-format";
export const TIME_FORMAT_STORAGE_KEY = "smartcrm-time-format";

export type DateFormatPreference = "dmy" | "mdy" | "iso" | "long";
export type TimeFormatPreference = "24h" | "12h";

/** "long" matches how dates already render today (27 Oct 2026), so nothing shifts until a user chooses. */
export const DEFAULT_DATE_FORMAT: DateFormatPreference = "long";
export const DEFAULT_TIME_FORMAT: TimeFormatPreference = "24h";

export const DATE_FORMAT_OPTIONS: ReadonlyArray<{ value: DateFormatPreference; label: string }> = [
  { value: "dmy", label: "Day / Month / Year" },
  { value: "mdy", label: "Month / Day / Year" },
  { value: "iso", label: "Year-Month-Day" },
  { value: "long", label: "Day Month Year (words)" },
];

export const TIME_FORMAT_OPTIONS: ReadonlyArray<{ value: TimeFormatPreference; label: string }> = [
  { value: "24h", label: "24-hour" },
  { value: "12h", label: "12-hour (AM/PM)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

export function isDateFormatPreference(value: string | null | undefined): value is DateFormatPreference {
  return value === "dmy" || value === "mdy" || value === "iso" || value === "long";
}

export function isTimeFormatPreference(value: string | null | undefined): value is TimeFormatPreference {
  return value === "24h" || value === "12h";
}

export function formatDateWith(date: Date, format: DateFormatPreference): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  switch (format) {
    case "mdy":
      return `${pad(m)}/${pad(d)}/${y}`;
    case "iso":
      return `${y}-${pad(m)}-${pad(d)}`;
    case "long":
      return `${d} ${MONTHS[m - 1]} ${y}`;
    default:
      return `${pad(d)}/${pad(m)}/${y}`;
  }
}

/** Same as formatDateWith without the year (e.g. "27 Oct", "10/27"). */
export function formatShortDateWith(date: Date, format: DateFormatPreference): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  switch (format) {
    case "mdy":
      return `${pad(m)}/${pad(d)}`;
    case "iso":
      return `${pad(m)}-${pad(d)}`;
    case "long":
      return `${d} ${MONTHS[m - 1]}`;
    default:
      return `${pad(d)}/${pad(m)}`;
  }
}

export function formatTimeWith(date: Date, format: TimeFormatPreference): string {
  const h = date.getHours();
  const min = pad(date.getMinutes());
  if (format === "12h") {
    return `${h % 12 === 0 ? 12 : h % 12}:${min} ${h < 12 ? "AM" : "PM"}`;
  }
  return `${pad(h)}:${min}`;
}

function readKey<T extends string>(key: string, guard: (v: string | null) => v is T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return guard(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function readStoredDateFormat(): DateFormatPreference {
  return readKey(DATE_FORMAT_STORAGE_KEY, isDateFormatPreference, DEFAULT_DATE_FORMAT);
}

export function readStoredTimeFormat(): TimeFormatPreference {
  return readKey(TIME_FORMAT_STORAGE_KEY, isTimeFormatPreference, DEFAULT_TIME_FORMAT);
}

const CHANGE_EVENT = "smartcrm-regional-format-change";

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function writeStoredDateFormat(format: DateFormatPreference): void {
  write(DATE_FORMAT_STORAGE_KEY, format);
}

export function writeStoredTimeFormat(format: TimeFormatPreference): void {
  write(TIME_FORMAT_STORAGE_KEY, format);
}

export function subscribeRegionalFormat(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// ---------------------------------------------------------------------------
// Active preference — used by plain formatting helpers (lib code, labels).
// RegionalFormatProvider keeps this in sync and re-mounts the tree on change.
// ---------------------------------------------------------------------------

let activeDateFormat: DateFormatPreference = DEFAULT_DATE_FORMAT;
let activeTimeFormat: TimeFormatPreference = DEFAULT_TIME_FORMAT;

export function setActiveRegionalFormat(date: DateFormatPreference, time: TimeFormatPreference): void {
  activeDateFormat = date;
  activeTimeFormat = time;
}

export type FormatInput = Date | string | number | null | undefined;

function toDate(value: FormatInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "27 Oct 2026" / "27/10/2026" / … per the user's choice. Invalid input → fallback. */
export function formatDate(value: FormatInput, fallback = ""): string {
  const date = toDate(value);
  return date ? formatDateWith(date, activeDateFormat) : fallback;
}

/** Date without year, e.g. "27 Oct". */
export function formatShortDate(value: FormatInput, fallback = ""): string {
  const date = toDate(value);
  return date ? formatShortDateWith(date, activeDateFormat) : fallback;
}

export function formatTime(value: FormatInput, fallback = ""): string {
  const date = toDate(value);
  return date ? formatTimeWith(date, activeTimeFormat) : fallback;
}

/** "27 Oct 2026, 15:45" */
export function formatDateTime(value: FormatInput, fallback = ""): string {
  const date = toDate(value);
  return date ? `${formatDateWith(date, activeDateFormat)}, ${formatTimeWith(date, activeTimeFormat)}` : fallback;
}

// ---------------------------------------------------------------------------
// Form-field helpers: value stays ISO (yyyy-mm-dd / HH:mm), display follows preference.
// ---------------------------------------------------------------------------

export function getActiveDateFormat(): DateFormatPreference {
  return activeDateFormat;
}

export function getActiveTimeFormat(): TimeFormatPreference {
  return activeTimeFormat;
}

export function datePlaceholder(format: DateFormatPreference = activeDateFormat): string {
  switch (format) {
    case "mdy":
      return "mm/dd/yyyy";
    case "iso":
      return "yyyy-mm-dd";
    case "long":
      return "27 Oct 2026";
    default:
      return "dd/mm/yyyy";
  }
}

export function timePlaceholder(format: TimeFormatPreference = activeTimeFormat): string {
  return format === "12h" ? "9:00 AM" : "09:00";
}

/** "2026-10-27" → display text per preference. Invalid → "". */
export function isoDateToDisplay(iso: string, format: DateFormatPreference = activeDateFormat): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? "" : formatDateWith(date, format);
}

function buildIso(y: number, m: number, d: number): string | null {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Parse what the user typed (active format first, ISO always accepted) → "yyyy-mm-dd" or null. */
export function parseDateInput(text: string, format: DateFormatPreference = activeDateFormat): string | null {
  const t = text.trim();
  if (!t) return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (iso) return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const words = /^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/.exec(t);
  if (words) {
    const idx = MONTHS.findIndex((mo) => words[2].toLowerCase().startsWith(mo.toLowerCase()));
    if (idx >= 0) return buildIso(Number(words[3]), idx + 1, Number(words[1]));
    return null;
  }

  const num = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(t);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const y = Number(num[3]);
    return format === "mdy" ? buildIso(y, a, b) : buildIso(y, b, a);
  }
  return null;
}

/** "09:00" → "9:00 AM" / "09:00" per preference. */
export function isoTimeToDisplay(hhmm: string, format: TimeFormatPreference = activeTimeFormat): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!match) return "";
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return Number.isNaN(date.getTime()) ? "" : formatTimeWith(date, format);
}

/** Parse typed time ("9", "9:30", "0930", "9:30 pm") → "HH:mm" or null. */
export function parseTimeInput(text: string): string | null {
  const t = text.trim().toLowerCase();
  const match = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!match) return null;
  let h = Number(match[1]);
  const min = match[2] ? Number(match[2]) : 0;
  const mer = match[3]?.[0];
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "p" && h < 12) h += 12;
    if (mer === "a" && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return `${pad(h)}:${pad(min)}`;
}
