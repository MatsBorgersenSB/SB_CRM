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
 * New Outlook and Outlook on the web already hand back REST item ids.
 * convertToRestId on those hosts corrupts the id, and Graph then cannot read the mail.
 */
export function mailboxHostUsesRestItemIds(hostName: string | null | undefined): boolean {
  const host = hostName?.trim() ?? "";
  return host === "OutlookWebApp" || host === "newOutlookWindows";
}
