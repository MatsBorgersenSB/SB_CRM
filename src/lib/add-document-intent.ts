/**
 * "Add document" is always one click away. Documents live on a record
 * (company, person, opportunity, project), so the action jumps to the
 * documents area of the record the user is looking at and opens the upload mode.
 */
export const ADD_DOCUMENT_EVENT = "smartcrm:add-document";
export const ADD_DOCUMENT_PENDING_KEY = "smartcrm:add-document-pending";

const PENDING_TTL_MS = 10_000;

/** Remember the click so a documents panel that mounts a moment later can open upload. */
export function markAddDocumentPending(): void {
  sessionStorage.setItem(ADD_DOCUMENT_PENDING_KEY, String(Date.now()));
}

/** True once, and only if the click was recent — a stale flag must not hijack a later visit. */
export function consumeAddDocumentPending(): boolean {
  const raw = sessionStorage.getItem(ADD_DOCUMENT_PENDING_KEY);
  if (raw === null) return false;
  sessionStorage.removeItem(ADD_DOCUMENT_PENDING_KEY);
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < PENDING_TTL_MS;
}

/** Documents URL for the record in `pathname`, or null when no record is open. */
export function documentsUrlForPath(pathname: string): string | null {
  const match = /^\/(companies|contacts|opportunities|deals|projects)\/([^/?#]+)/.exec(
    pathname,
  );
  if (!match) return null;
  const [, kind, id] = match;
  const base = `/${kind}/${id}`;
  if (kind === "opportunities" || kind === "deals" || kind === "projects") {
    return `${base}?view=actions&action=documents`;
  }
  return `${base}#documents`;
}

/** Documents URL for a company picked in the "where does it belong?" dialog. */
export function documentsUrlForCompany(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}#documents`;
}
