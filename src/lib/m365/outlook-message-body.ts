/** Read Outlook message body for signature parsing (client-only). */

import { stripHtmlToText } from "@/lib/m365/signature-intelligence";

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

export async function resolveOutlookMessageBody(): Promise<string | null> {
  if (typeof window === "undefined" || typeof Office === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      Office.onReady(() => {
        void (async () => {
          try {
            const body = Office.context.mailbox?.item?.body;
            if (!body?.getAsync) {
              finish(null);
              return;
            }

            const textBody = await readBodyAsync(body, Office.CoercionType.Text);
            if (textBody) {
              finish(textBody);
              return;
            }

            const htmlBody = await readBodyAsync(body, Office.CoercionType.Html);
            if (htmlBody) {
              const plain = stripHtmlToText(htmlBody);
              finish(plain.trim() ? plain : null);
              return;
            }

            finish(null);
          } catch {
            finish(null);
          }
        })();
      });
    } catch {
      finish(null);
    }
  });
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
