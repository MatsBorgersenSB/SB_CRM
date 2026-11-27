const USER_AGENT = "SmartCRM-WebsiteDiscovery/1.0";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_PAGES = 8;
const MAX_FETCH_ATTEMPTS = 18;

/** Known path suffixes tried when a root/homepage URL is entered (fallback). */
const CONTACT_PATHS = [
  "/impressum",
  "/imprint",
  "/legal",
  "/kontakt",
  "/contact",
  "/contact-us",
  "/ansprechpartner",
  "/om-oss",
  "/om-oss-og-kontakt",
  "/about",
  "/about-us",
  "/about-us-contacts",
  "/ueber-uns",
  "/team",
  "/our-team",
  "/vart-team",
  "/vårt-team",
  "/medarbeidere",
  "/ansatte",
  "/people",
  "/staff",
  "/de/impressum",
  "/de/kontakt",
  "/nb/kontakt",
  "/nb/om-oss",
  "/nb/om-oss-og-kontakt",
  "/nb/team",
  "/no/kontakt",
  "/no/om-oss",
  "/en/contact",
  "/en/about",
  "/en/about-us-contacts",
  "/en/team",
];

/**
 * Path segments that indicate imprint / legal / contact / team / about pages.
 * Used when deep-crawling links discovered in HTML.
 */
const CONTACT_LINK_PATTERN =
  /(?:^|\/)(?:nb|no|en|sv|da|fi|de|fr|nl|es|it|pl)?\/?(?:impressum|imprint|legal(?:-notice|-information|-info)?|rechtliches|mentions-l[eé]gales|om-oss(?:-og-kontakt)?|kontakt(?:personer)?|contact(?:-us|-person|-persons|s)?|ansprechpartner|about(?:-us)?(?:-contacts)?|ueber-uns|[uü]ber-uns|unternehmen|company|team|our-team|v[aå]rt-team|medarbeidere|ansatte|people|staff|management|leadership|ledelse|gesch[aä]ftsf[uü]hrung|geschaeftsfuehrung|over-ons|om-foretaget)(?:\/|$)/i;

const NON_PAGE_ASSET_PATTERN =
  /(?:\/wp-content\/|\/wp-includes\/|\/assets\/|\.(?:css|js|json|xml|png|jpe?g|gif|svg|webp|ico|pdf|zip|woff2?|ttf|eot|mp4|webm)$)/i;

function scoreContactLinkPriority(url: string): number {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (/(?:^|\/)(?:impressum|imprint|legal(?:-notice|-information|-info)?|rechtliches|mentions-l[eé]gales)(?:\/|$)/i.test(pathname)) {
    return 1;
  }
  if (/(?:^|\/)(?:ansprechpartner|contact-person|contact-persons|kontaktpersoner|team|our-team|v[aå]rt-team|medarbeidere|ansatte|people|staff|management|leadership|ledelse|gesch[aä]ftsf[uü]hrung|geschaeftsfuehrung)(?:\/|$)/i.test(pathname)) {
    return 2;
  }
  if (/(?:^|\/)(?:kontakt|contact(?:-us|s)?)(?:\/|$)/i.test(pathname)) {
    return 3;
  }
  return 4;
}

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

function isRootLikePath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  return path === "/" || /^\/(nb|no|en|sv|da|fi|de|fr|nl|es|it|pl)$/i.test(path);
}

function pathKey(url: string): string {
  return url.replace(/\/$/, "").toLowerCase();
}

function normalizeFinalUrl(rawUrl: string, fallbackUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "") || parsed.origin;
  } catch {
    return fallbackUrl.replace(/\/$/, "") || fallbackUrl;
  }
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const key = pathKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
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

    return {
      html: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      finalUrl: normalizeFinalUrl(response.url || url, url),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Extract same-origin imprint/about/contact/team links from an HTML document. */
export function discoverContactLinks(html: string, pageUrl: string): string[] {
  const origin = originFromUrl(pageUrl);
  const found: string[] = [];
  const hrefPattern = /href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html)) !== null) {
    const raw = (match[1] ?? "").trim();
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
      continue;
    }

    let absolute: URL;
    try {
      absolute = new URL(raw, pageUrl);
    } catch {
      continue;
    }

    if (absolute.origin !== origin) continue;
    absolute.hash = "";
    absolute.search = "";

    const pathname = absolute.pathname || "/";
    if (NON_PAGE_ASSET_PATTERN.test(pathname)) continue;
    if (!CONTACT_LINK_PATTERN.test(pathname)) continue;

    found.push(absolute.toString().replace(/\/$/, "") || absolute.origin);
  }

  return uniqueUrls(found).sort(
    (a, b) => scoreContactLinkPriority(a) - scoreContactLinkPriority(b),
  );
}

/**
 * Fetch the start URL (full subpage URLs supported) and deep-crawl related
 * imprint / contact / team / about pages. Root domains crawl discovered nav links
 * first (prioritized by signal value), deduplicating redirects, then fall back to
 * known path candidates only when few pages were discovered.
 */
export async function fetchWebsitePages(startUrl: string): Promise<{
  pages: { url: string; html: string }[];
}> {
  const normalized = normalizeWebsiteUrl(startUrl);
  const origin = originFromUrl(normalized);
  const pathname = new URL(normalized).pathname;
  const rootLike = isRootLikePath(pathname);

  const seen = new Set<string>();
  const pages: { url: string; html: string }[] = [];
  const discoveredQueue: string[] = [];
  let fallbackSeeded = false;
  let attempts = 0;

  const enqueueDiscovered = (url: string) => {
    const key = pathKey(url);
    if (seen.has(key)) return;
    if (discoveredQueue.some((queued) => pathKey(queued) === key)) return;
    discoveredQueue.push(url);
  };

  // Always start with the exact URL the user provided (supports deep subpages).
  enqueueDiscovered(normalized);

  while (discoveredQueue.length > 0 && pages.length < MAX_PAGES && attempts < MAX_FETCH_ATTEMPTS) {
    const candidate = discoveredQueue.shift()!;
    const key = pathKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    attempts += 1;

    const fetched = await fetchHtml(candidate);
    if (!fetched) continue;

    const finalKey = pathKey(fetched.finalUrl);
    if (finalKey !== key && seen.has(finalKey)) {
      continue;
    }
    seen.add(finalKey);

    pages.push({ url: fetched.finalUrl, html: fetched.html });

    const discovered = discoverContactLinks(fetched.html, fetched.finalUrl);
    for (const link of discovered) {
      enqueueDiscovered(link);
    }
    discoveredQueue.sort((a, b) => scoreContactLinkPriority(a) - scoreContactLinkPriority(b));

    // If discovered links run dry and we still have few pages, try known fallback paths.
    if (discoveredQueue.length === 0 && !fallbackSeeded && pages.length < 4) {
      fallbackSeeded = true;
      const fallbackSlice = rootLike ? CONTACT_PATHS : CONTACT_PATHS.slice(0, 10);
      for (const path of fallbackSlice) {
        enqueueDiscovered(`${origin}${path}`);
      }
    }
  }

  return { pages };
}
