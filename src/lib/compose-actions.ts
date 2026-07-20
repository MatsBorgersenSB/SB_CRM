export function normalizePhoneForTel(phone: string): string {
  return phone.replace(/\s/g, "");
}

/**
 * Build a query string for mail/compose deeplinks.
 *
 * URLSearchParams uses application/x-www-form-urlencoded rules (+ for spaces).
 * Outlook compose and many mail clients expect RFC 3986 encoding (%20 for spaces)
 * and CRLF (%0D%0A) for line breaks — otherwise subjects/bodies show "+" artifacts.
 */
function encodeComposeQueryParam(value: string): string {
  return encodeURIComponent(value);
}

function normalizeComposeBody(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
}

function buildComposeQueryString(
  entries: Array<[string, string | undefined]>,
): string {
  return entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeComposeQueryParam(value)}`)
    .join("&");
}

export function outlookComposeHref(
  email: string,
  subject?: string,
  body?: string,
): string {
  const query = buildComposeQueryString([
    ["to", email],
    ["subject", subject],
    ["body", body ? normalizeComposeBody(body) : undefined],
  ]);
  return `https://outlook.office.com/mail/deeplink/compose?${query}`;
}

/** M365 web mail compose (Outlook on the web). */
export function m365ComposeHref(email: string, subject?: string, body?: string): string {
  return outlookComposeHref(email, subject, body);
}

export function mailtoHref(email: string, subject?: string, body?: string): string {
  const query = buildComposeQueryString([
    ["subject", subject],
    ["body", body ? normalizeComposeBody(body) : undefined],
  ]);
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}

export function teamsMeetingComposeHref(subject: string, content?: string): string {
  const query = buildComposeQueryString([
    ["subject", subject],
    ["content", content ? normalizeComposeBody(content) : undefined],
  ]);
  return `https://teams.microsoft.com/l/meeting/new?${query}`;
}

export function telHref(phone: string): string {
  return `tel:${normalizePhoneForTel(phone)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
