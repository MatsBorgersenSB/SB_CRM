const QUOTE_START =
  /(?:^|\s)(?:-{2,}\s*Original Message\s*-{2,}|On .{0,120}?wrote:|Den .{0,120}?skrev[: ]|From:|Fra:|Sent:|Sendt:|To:|Til:|Subject:|Emne:)/i;

const SIGNATURE_START =
  /(?:^|\s)(?:Best regards|Kind regards|Med vennlig hilsen|Vennlig hilsen|Mvh\b|This email, including any attachments, is confidential|Sent from my |Sendt fra min )/i;

function htmlToText(value: string): string {
  if (!/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'");
}

/** The words of one mail, without the signature, disclaimer, or quoted earlier mail. */
export function readableMailText(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  let text = htmlToText(raw).replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  text = text.replace(
    /\s+(Best regards|Kind regards|Med vennlig hilsen|Vennlig hilsen|Mvh\b|This email, including any attachments, is confidential|Sent from my |Sendt fra min |From:|Fra:|Sent:|Sendt:|Subject:|Emne:)/gi,
    "\n$1",
  );

  let cut = text.length;
  for (const pattern of [SIGNATURE_START, QUOTE_START]) {
    const match = pattern.exec(text);
    if (match && match.index >= 24 && match.index < cut) cut = match.index;
  }
  text = text.slice(0, cut);
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
