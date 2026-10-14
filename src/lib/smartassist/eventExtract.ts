import { stripHtml } from "@/lib/smartassist/graphSearch";

/**
 * SmartAssist event reader.
 *
 * Given a public event URL or pasted invitation text, propose a tradeshow /
 * seminar activity: name, dates, place, organizer, themes, and why it matters.
 * Deterministic parsing runs first so a proposal exists without a model; the
 * model only enriches themes and relevance. The user confirms before anything
 * is saved (system thinks, user decides).
 */

export type EventProposal = {
  title: string;
  /** YYYY-MM-DD */
  startDate: string | null;
  /** YYYY-MM-DD, inclusive */
  endDate: string | null;
  location: string | null;
  organizer: string | null;
  website: string | null;
  themes: string[];
  /** One or two sentences: what the event is and why Standard Bio might attend. */
  summary: string;
  /** Which signals were found in the source; drives the confidence hint. */
  found: { title: boolean; dates: boolean; location: boolean };
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 12_000;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januar: 1,
  feb: 2, february: 2, februar: 2,
  mar: 3, march: 3, mars: 3,
  apr: 4, april: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, des: 12, desember: 12,
};

const MULTI_WORD_COUNTRIES = new Set([
  "united kingdom", "united states", "united arab emirates", "new zealand", "south africa",
  "south korea", "saudi arabia", "czech republic", "hong kong", "costa rica", "sri lanka",
  "the netherlands", "el salvador", "puerto rico", "dominican republic", "north macedonia",
]);

const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Find the first date or date range in free text.
 * Handles "1 - 3 December 2026", "1–3 Dec 2026", "December 1-3, 2026",
 * "30 Nov – 2 Dec 2026", and single dates like "3 December 2026".
 */
export function parseEventDates(text: string): { startDate: string; endDate: string } | null {
  const dash = "[-–—‒]|to|til";
  // "1 - 3 December 2026" | "30 Nov - 2 Dec 2026"
  const dayFirst = new RegExp(
    `\\b(\\d{1,2})\\.?\\s*(?:(${MONTH_PATTERN})\\.?\\s*)?(?:${dash})\\s*(\\d{1,2})\\.?\\s+(${MONTH_PATTERN})\\.?,?\\s+(\\d{4})\\b`,
    "i",
  );
  // "December 1-3, 2026"
  const monthFirst = new RegExp(
    `\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})\\s*(?:${dash})\\s*(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "i",
  );
  // "3 December 2026" | "December 3, 2026"
  const single = new RegExp(
    `\\b(?:(\\d{1,2})\\.?\\s+(${MONTH_PATTERN})\\.?,?\\s+(\\d{4})|(${MONTH_PATTERN})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4}))\\b`,
    "i",
  );

  const a = dayFirst.exec(text);
  if (a) {
    const startDay = Number(a[1]);
    const endMonth = MONTHS[a[4]!.toLowerCase()]!;
    const startMonth = a[2] ? MONTHS[a[2].toLowerCase()]! : endMonth;
    const year = Number(a[5]);
    const startDate = iso(year, startMonth, startDay);
    const endDate = iso(year, endMonth, Number(a[3]));
    if (startDate && endDate && endDate >= startDate) return { startDate, endDate };
  }
  const b = monthFirst.exec(text);
  if (b) {
    const month = MONTHS[b[1]!.toLowerCase()]!;
    const year = Number(b[4]);
    const startDate = iso(year, month, Number(b[2]));
    const endDate = iso(year, month, Number(b[3]));
    if (startDate && endDate && endDate >= startDate) return { startDate, endDate };
  }
  const c = single.exec(text);
  if (c) {
    const day = Number(c[1] ?? c[5]);
    const month = MONTHS[(c[2] ?? c[4])!.toLowerCase()]!;
    const year = Number(c[3] ?? c[6]);
    const date = iso(year, month, day);
    if (date) return { startDate: date, endDate: date };
  }
  return null;
}

/** "Tokyo, Japan" style place that follows a date range or a "|" separator. */
export function parseEventLocation(text: string): string | null {
  const afterDates =
    /\b\d{4}\s*(?:[|·,–-]\s*)?(?:at\s+|in\s+)?([A-ZÆØÅ][\p{L}.'-]{1,30}(?: [A-ZÆØÅ][\p{L}.'-]{1,30})?),\s*([A-ZÆØÅ][\p{L}-]{2,30})(?: ([A-ZÆØÅ][\p{L}-]{2,30}))?/u.exec(
      text,
    );
  if (afterDates) {
    const city = titleCaseIfShouting(afterDates[1]!.trim());
    const first = afterDates[2]!;
    const second = afterDates[3];
    const pair = second ? `${first} ${second}` : null;
    const country = pair && MULTI_WORD_COUNTRIES.has(pair.toLowerCase()) ? pair : first;
    return `${city}, ${titleCaseIfShouting(country)}`;
  }
  const labelled = /\b(?:Venue|Location|Sted|Where)\s*[:\-–]\s*([^\n|•]{3,80})/i.exec(text);
  if (labelled) return labelled[1]!.trim().replace(/\s+/g, " ");
  return null;
}

export function readHtmlTitle(html: string): string | null {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)
    ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html);
  if (og?.[1]) return decode(og[1]).trim();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) return decode(title[1]).replace(/\s+/g, " ").trim();
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1?.[1]) return stripHtml(h1[1]).trim();
  return null;
}

function decode(value: string): string {
  return stripHtml(value);
}

const TITLE_FILLER = /\b(home|welcome|official site|tickets?|registration|schedule|agenda|conference|summit|event|exhibition|expo)\b[\s,]*$/i;

function cleanTitle(raw: string | null): string {
  if (!raw) return "";
  let title = raw.split(/\s[|–—-]\s/)[0]!.trim();
  // Strip SEO filler words from the end, repeatedly ("… Tokyo Event" → "… Tokyo").
  for (let i = 0; i < 4 && TITLE_FILLER.test(title); i += 1) {
    title = title.replace(TITLE_FILLER, "").trim();
  }
  // Drop a trailing word that already appears earlier ("DeCarbon Tokyo 2026 Tokyo").
  const words = title.split(/\s+/);
  if (words.length > 2) {
    const last = words[words.length - 1]!.toLowerCase();
    if (words.slice(0, -1).some((word) => word.toLowerCase() === last)) words.pop();
  }
  return words.join(" ").slice(0, 120);
}

function titleCaseIfShouting(value: string): string {
  if (value.length < 3 || value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .split(/(\s|-)/)
    .map((part) => (/^[\s-]$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

export async function fetchEventHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "SmartCRM-EventReader/1.0",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/.test(contentType)) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) return null;
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const THIN_PAGE_CHARS = 600;
const CONTINUE_LINK = /continue|proceed|click here|go to (the )?(event|site|agenda)|view (the )?(agenda|event|programme|program)/i;

/**
 * Tracked marketing links often land on a thin "Click here to continue" gate.
 * When the page says almost nothing, return the single same-origin link it
 * wants us to follow (or a meta-refresh target). One hop only.
 */
export function findContinueTarget(html: string, pageUrl: string): string | null {
  if (stripHtml(html).length > THIN_PAGE_CHARS) return null;
  const origin = new URL(pageUrl).origin;
  const resolve = (raw: string): string | null => {
    try {
      const url = new URL(raw.trim(), pageUrl);
      if (url.origin !== origin) return null;
      if (url.toString() === pageUrl) return null;
      return url.toString();
    } catch {
      return null;
    }
  };
  const refresh = /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s;]+)/i.exec(html);
  if (refresh?.[1]) return resolve(refresh[1]);
  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    const label = stripHtml(match[2] ?? "").trim();
    if (CONTINUE_LINK.test(label)) return resolve(match[1] ?? "");
  }
  return null;
}

export function normalizeEventUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const TRACKING_PARAMS = /^(eid|em|email|e|uid|utm_\w+|mc_\w+|fbclid|gclid|msclkid|_hsenc|_hsmi|mkt_tok)$/i;

/** Public, shareable form of the event link: no recipient or campaign tracking. */
export function publicEventUrl(input: string): string {
  try {
    const url = new URL(input);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key) || key === "") url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().replace(/[?&]$/, "");
  } catch {
    return input;
  }
}

/** Deterministic proposal. Never invents: unknown fields stay null. */
export function proposeEventFromText(input: {
  text: string;
  html?: string | null;
  sourceUrl?: string | null;
}): EventProposal {
  const text = input.text.replace(/\s+/g, " ").trim();
  const htmlTitle = input.html ? readHtmlTitle(input.html) : null;
  const firstLine = input.text.split(/\n/).map((line) => line.trim()).find((line) => line.length > 3) ?? "";
  const title = cleanTitle(htmlTitle) || cleanTitle(firstLine);
  const dates = parseEventDates(text);
  const location = parseEventLocation(text);
  const website = input.sourceUrl ?? null;
  return {
    title,
    startDate: dates?.startDate ?? null,
    endDate: dates?.endDate ?? null,
    location,
    organizer: null,
    website,
    themes: [],
    summary: title
      ? `${title}${dates ? ` runs ${dates.startDate}${dates.endDate !== dates.startDate ? ` to ${dates.endDate}` : ""}` : ""}${location ? ` in ${location}` : ""}.`
      : "",
    found: { title: Boolean(title), dates: Boolean(dates), location: Boolean(location) },
  };
}

const SYSTEM_PROMPT = `You read event pages and invitations for Standard Bio, a company selling pyrolysis machinery and professional services for biochar, carbon removal, timber/forestry residues, municipal sludge, and energy utilities.
Return strict JSON with keys: title (string), startDate (YYYY-MM-DD or null), endDate (YYYY-MM-DD or null), location ("City, Country" or null), organizer (string or null), themes (array of 3-5 short strings), summary (one or two sentences: what the event is and why it may matter to Standard Bio).
Rules: use only what the text states. If a value is not in the text, return null. Do not guess dates. Keep summary factual.`;

type ModelDraft = Partial<Record<keyof EventProposal, unknown>>;

async function askModel(text: string, nowIso: string): Promise<ModelDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model =
    process.env.OPENAI_SMARTASSIST_MODEL?.trim() ||
    process.env.OPENAI_TENDER_MODEL?.trim() ||
    "gpt-4o-mini";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ now: nowIso, text: text.slice(0, MAX_TEXT_CHARS) }) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return JSON.parse(content) as ModelDraft;
  } catch {
    return null;
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoDate(value: unknown): string | null {
  const s = str(value);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Merge a model draft onto the deterministic proposal. Parsed dates win over the model. */
export function mergeProposal(base: EventProposal, draft: ModelDraft | null): EventProposal {
  if (!draft) return base;
  const startDate = base.startDate ?? isoDate(draft.startDate);
  const endDate = base.endDate ?? isoDate(draft.endDate) ?? startDate;
  const themes = Array.isArray(draft.themes)
    ? draft.themes.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim()).slice(0, 5)
    : [];
  return {
    title: base.title || str(draft.title)?.slice(0, 120) || "",
    startDate,
    endDate: endDate && startDate && endDate < startDate ? startDate : endDate,
    location: base.location ?? str(draft.location),
    organizer: str(draft.organizer),
    website: base.website,
    themes,
    summary: str(draft.summary) ?? base.summary,
    found: {
      title: Boolean(base.title || str(draft.title)),
      dates: Boolean(startDate),
      location: Boolean(base.location ?? str(draft.location)),
    },
  };
}

export async function extractEvent(input: { url?: string; text?: string; now?: Date }): Promise<EventProposal | null> {
  const now = input.now ?? new Date();
  const url = input.url ? normalizeEventUrl(input.url) : null;
  let html: string | null = null;
  let text = input.text?.trim() ?? "";

  let pageUrl = url;
  if (url) {
    html = await fetchEventHtml(url);
    const next = html ? findContinueTarget(html, url) : null;
    if (next) {
      const nextHtml = await fetchEventHtml(next);
      if (nextHtml) {
        html = nextHtml;
        pageUrl = next;
      }
    }
    if (html) text = [stripHtml(html).slice(0, MAX_TEXT_CHARS), text].filter(Boolean).join("\n\n");
  }
  if (!text) return null;

  const base = proposeEventFromText({ text, html, sourceUrl: pageUrl ? publicEventUrl(pageUrl) : null });
  const draft = await askModel(text, now.toISOString());
  const merged = mergeProposal(base, draft);
  return merged.title || merged.startDate ? merged : null;
}
