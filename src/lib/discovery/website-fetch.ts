const USER_AGENT = "SmartCRM-WebsiteDiscovery/1.0";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_PAGES = 8;

/** Known path suffixes tried when a root/homepage URL is entered (fallback). */
const CONTACT_PATHS = [
  "/kontakt",
  "/contact",
  "/contact-us",
  "/om-oss",
  "/om-oss-og-kontakt",
  "/about",
  "/about-us",
  "/about-us-contacts",
  "/team",
  "/our-team",
  "/vart-team",
  "/vårt-team",
  "/medarbeidere",
  "/ansatte",
  "/people",
  "/staff",
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
 * Path segments that indicate about / contact / team pages.
 * Used when deep-crawling links discovered in HTML.
 */
const CONTACT_LINK_PATTERN =
  /(?:^|\/)(?:nb|no|en|sv|da|fi)?\/?(?:om-oss(?:-og-kontakt)?|kontakt|contact(?:-us)?|about(?:-us)?(?:-contacts)?|team|our-team|v[aå]rt-team|medarbeidere|ansatte|people|staff)(?:\/|$)/i;

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
  return path === "/" || /^\/(nb|no|en|sv|da|fi)$/i.test(path);
}

function pathKey(url: string): string {
  return url.replace(/\/$/, "").toLowerCase();
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

/** Extract same-origin about/contact/team links from an HTML document. */
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
    if (!CONTACT_LINK_PATTERN.test(pathname)) continue;

    found.push(absolute.toString().replace(/\/$/, "") || absolute.origin);
  }

  return uniqueUrls(found);
}

/**
 * Fetch the start URL (full subpage URLs supported) and deep-crawl related
 * about / contact / team pages. Root domains discover nav links first, then
 * fall back to known path candidates.
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
  const queue: string[] = [];

  const enqueue = (url: string, front = false) => {
    const key = pathKey(url);
    if (seen.has(key)) return;
    if (queue.some((queued) => pathKey(queued) === key)) return;
    if (pages.length + queue.length >= MAX_PAGES) return;
    if (front) queue.unshift(url);
    else queue.push(url);
  };

  // Always start with the exact URL the user provided (supports deep subpages).
  enqueue(normalized, true);

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const candidate = queue.shift()!;
    const key = pathKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);

    const html = await fetchHtml(candidate);
    if (!html) continue;

    pages.push({ url: candidate.replace(/\/$/, "") || candidate, html });

    const discovered = discoverContactLinks(html, candidate);
    for (const link of discovered) {
      enqueue(link, true);
    }

    // After the first root/homepage fetch, seed known path fallbacks behind discovered links.
    if (rootLike && pages.length === 1) {
      for (const path of CONTACT_PATHS) {
        enqueue(`${origin}${path}`);
      }
    }
  }

  // If a deep URL was entered and yielded few pages, still try a few sibling contact paths.
  if (!rootLike && pages.length > 0 && pages.length < 3) {
    const extras = uniqueUrls([
      ...CONTACT_PATHS.slice(0, 8).map((path) => `${origin}${path}`),
      ...discoverContactLinks(pages[0]!.html, pages[0]!.url),
    ]).filter((url) => !seen.has(pathKey(url)));

    for (const extra of extras) {
      if (pages.length >= MAX_PAGES) break;
      const key = pathKey(extra);
      if (seen.has(key)) continue;
      seen.add(key);
      const html = await fetchHtml(extra);
      if (html) pages.push({ url: extra.replace(/\/$/, "") || extra, html });
    }
  }

  return { pages };
}
