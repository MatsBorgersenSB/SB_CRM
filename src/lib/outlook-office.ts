/**
 * Safe Office.js readiness for Outlook task panes and Dialog SSO.
 * Never touch Office.context until onReady resolves — accessing context early
 * throws: "Office.js has not fully loaded".
 */

const OFFICE_SCRIPT = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
const READY_TIMEOUT_MS = 20_000;

function getOffice(): typeof Office | undefined {
  return typeof Office !== "undefined" ? Office : undefined;
}

function loadOfficeScript(): Promise<void> {
  if (getOffice()?.onReady) return Promise.resolve();
  if (typeof document === "undefined") return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${OFFICE_SCRIPT}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      if (getOffice()?.onReady) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Office.js")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = OFFICE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Office.js"));
    document.head.appendChild(script);
  });
}

/**
 * Resolves when Office.js is ready for Dialog / Mailbox APIs.
 * Returns null when not hosted in Office (browser preview / timeout).
 */
export async function whenOfficeReady(): Promise<NonNullable<typeof Office> | null> {
  try {
    await loadOfficeScript();
  } catch {
    return null;
  }

  const office = getOffice();
  if (!office?.onReady) return null;

  return await new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), READY_TIMEOUT_MS);
    try {
      office.onReady(() => {
        window.clearTimeout(timer);
        resolve(office);
      });
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

/** messageParent only after onReady — never touch Office.context earlier. */
export async function messageParentSafe(message: string): Promise<boolean> {
  const office = await whenOfficeReady();
  if (!office?.context?.ui?.messageParent) return false;
  try {
    office.context.ui.messageParent(message);
    return true;
  } catch {
    return false;
  }
}
