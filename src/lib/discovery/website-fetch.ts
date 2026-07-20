const USER_AGENT = "SmartCRM-WebsiteDiscovery/1.0";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000;

const CONTACT_PATHS = [
  "/kontakt",
  "/kontakt/",
  "/contact",
  "/contact/",
  "/om-oss",
  "/om-oss/",
  "/about",
  "/about/",
  "/about-us",
  "/about-us/",
  "/team",
  "/team/",
];

export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Website URL is required.");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "") || url.origin;
}

export function originFromUrl(url: string): string {
  return new URL(url).origin;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) return null;

    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWebsitePages(startUrl: string): Promise<{
  pages: { url: string; html: string }[];
}> {
  const normalized = normalizeWebsiteUrl(startUrl);
  const origin = originFromUrl(normalized);
  const candidates = [normalized, `${normalized}/`, ...CONTACT_PATHS.map((p) => `${origin}${p}`)];

  const seen = new Set<string>();
  const pages: { url: string; html: string }[] = [];

  for (const candidate of candidates) {
    const key = candidate.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const html = await fetchHtml(candidate);
    if (html) {
      pages.push({ url: candidate, html });
    }
  }

  return { pages };
}
