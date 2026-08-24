/** Read Outlook message body for signature parsing (client-only). */

import { stripHtmlToText } from "@/lib/m365/signature-intelligence";
import { whenOfficeReady } from "@/lib/outlook-office";

function readBodyAsync(
  body: Office.Body,
  coercion: Office.CoercionType,
): Promise<string | null> {
  return new Promise((resolve) => {
    body.getAsync(coercion, (result) => {
      if (result.status !== Office.AsyncResultStatus.Succeeded) {
        resolve(null);
        return;
      }
      const value = result.value?.trim();
      resolve(value || null);
    });
  });
}

function mergeMessageBodies(textBody: string | null, htmlBody: string | null): string | null {
  const fromHtml = htmlBody ? stripHtmlToText(htmlBody).trim() : "";
  const fromText = textBody?.trim() ?? "";
  if (!fromHtml && !fromText) return null;
  if (!fromHtml) return fromText;
  if (!fromText) return fromHtml;
  // Prefer HTML (tel: links) — concatenating both mixes recipient mailto chrome into the signature.
  return fromHtml;
}

export async function resolveOutlookMessageBody(): Promise<string | null> {
  const office = await whenOfficeReady();
  if (!office) return null;

  try {
    const body = office.context.mailbox?.item?.body;
    if (!body?.getAsync) return null;

    const [textBody, htmlBody] = await Promise.all([
      readBodyAsync(body, Office.CoercionType.Text),
      readBodyAsync(body, Office.CoercionType.Html),
    ]);

    return mergeMessageBodies(textBody, htmlBody);
  } catch {
    return null;
  }
}

export function resolveDevMessageBody(searchParams: URLSearchParams): string | null {
  const signature = searchParams.get("signature");
  if (!signature) return null;
  try {
    return decodeURIComponent(signature);
  } catch {
    return signature;
  }
}

export function logOutlookImportClient(stage: string, payload: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[SmartCRM Outlook Import] ${stage}`, payload);
}
