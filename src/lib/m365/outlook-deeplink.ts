/**
 * Outlook read deeplink from a mailbox item id (REST or EWS).
 * Used when Graph webLink was never stored (add-in capture without Mail.Read).
 */
export function buildOutlookReadDeeplink(itemId: string): string | null {
  const id = itemId.trim();
  if (!id) return null;
  return `https://outlook.office.com/owa/?ItemID=${encodeURIComponent(id)}&exvsurl=1&viewmodel=ReadMessageItem`;
}
