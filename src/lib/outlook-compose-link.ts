/** Outlook on the web compose window — opens a blank, editable new mail. */
export function outlookComposeUrl(options?: {
  to?: string;
  subject?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.to) params.set("to", options.to);
  if (options?.subject) params.set("subject", options.subject);
  const query = params.toString();
  return `https://outlook.office.com/mail/deeplink/compose${query ? `?${query}` : ""}`;
}
