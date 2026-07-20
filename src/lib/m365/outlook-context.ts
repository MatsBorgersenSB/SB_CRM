/**
 * Outlook sender resolution — email, display name, and dev query-param fallbacks.
 */

export type OutlookSenderDetails = {
  email: string;
  displayName: string;
};

export async function resolveOutlookSenderDetails(): Promise<OutlookSenderDetails | null> {
  if (typeof window === "undefined" || typeof Office === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: OutlookSenderDetails | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      Office.onReady(() => {
        try {
          const item = Office.context.mailbox?.item;
          if (!item) {
            finish(null);
            return;
          }

          const selfEmail = Office.context.mailbox?.userProfile?.emailAddress
            ?.trim()
            .toLowerCase();

          const fromEmail = item.from?.emailAddress?.trim().toLowerCase();
          if (fromEmail && fromEmail !== selfEmail) {
            finish({
              email: fromEmail,
              displayName: item.from?.displayName?.trim() ?? "",
            });
            return;
          }

          const attendeeSource = item.requiredAttendees ?? item.optionalAttendees ?? item.to;
          if (!attendeeSource) {
            finish(null);
            return;
          }

          attendeeSource.getAsync((result) => {
            if (result.status !== Office.AsyncResultStatus.Succeeded) {
              finish(null);
              return;
            }

            const match = result.value?.find((entry) => {
              const email = entry.emailAddress?.trim().toLowerCase();
              return email && email !== selfEmail;
            });

            if (!match?.emailAddress) {
              finish(null);
              return;
            }

            finish({
              email: match.emailAddress.trim().toLowerCase(),
              displayName: match.displayName?.trim() ?? "",
            });
          });
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });
}

export async function resolveOutlookCounterpartyEmail(): Promise<string | null> {
  const sender = await resolveOutlookSenderDetails();
  return sender?.email ?? null;
}

export function resolveDevEmail(searchParams: URLSearchParams): string | null {
  const email = searchParams.get("email")?.trim().toLowerCase();
  return email || null;
}

export function resolveDevDisplayName(searchParams: URLSearchParams): string | null {
  const name = searchParams.get("name")?.trim();
  return name || null;
}

export function buildSmartCrmUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
