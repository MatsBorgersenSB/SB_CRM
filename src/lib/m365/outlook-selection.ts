/**
 * Identity of the Outlook reading selection.
 * Multi-select in new Outlook clears the open item, so the checked ids must
 * be part of the key — otherwise checking more mails looks like no change.
 */
export function outlookSelectionFingerprint(
  itemId: string | null | undefined,
  conversationId: string | null | undefined,
  selectedItemIds: readonly string[],
): string {
  const ids = [
    ...new Set(selectedItemIds.map((id) => id.trim()).filter(Boolean)),
  ].sort();
  return `${itemId?.trim() ?? ""}::${conversationId?.trim() ?? ""}::${ids.join(",")}`;
}

/**
 * New Outlook and Outlook on the web already hand back REST item ids on some surfaces,
 * while getSelectedItemsAsync can still hand back EWS ids (`/` and `+`).
 * Never call Office.js convertToRestId on those hosts; normalize `/` -> `-` and `+` -> `_` directly.
 */
export function mailboxHostUsesRestItemIds(hostName: string | null | undefined): boolean {
  const host = hostName?.trim() ?? "";
  return host === "OutlookWebApp" || host === "newOutlookWindows";
}

/**
 * Convert an Exchange EWS item id (standard Base64 with `/` and `+`) into a
 * Microsoft Graph REST v2.0 message id (URL-safe Base64 with `-` and `_`).
 * Idempotent when the id is already in Graph REST format.
 */
export function toGraphRestMessageId(itemId: string | null | undefined): string {
  const raw = itemId?.trim() ?? "";
  if (!raw) return "";
  return raw.replace(/\//g, "-").replace(/\+/g, "_");
}

/**
 * Convert a Microsoft Graph REST v2.0 message id (`-` and `_`) into an
 * Exchange EWS item id (`/` and `+`) for SOAP GetItem requests.
 */
export function toEwsMessageId(itemId: string | null | undefined): string {
  const raw = itemId?.trim() ?? "";
  if (!raw) return "";
  return raw.replace(/-/g, "/").replace(/_/g, "+");
}

/**
 * Both Graph REST and EWS representations of an Outlook message id so DB
 * lookups match rows saved before REST id normalization.
 */
export function messageIdVariants(itemId: string | null | undefined): string[] {
  const raw = itemId?.trim() ?? "";
  if (!raw) return [];
  return [...new Set([raw, toGraphRestMessageId(raw), toEwsMessageId(raw)].filter(Boolean))];
}
