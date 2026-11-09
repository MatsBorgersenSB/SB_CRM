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
 * Pass a shorter `timeoutMs` for Sign In so dialog fallback is fast.
 */
export async function whenOfficeReady(
  timeoutMs: number = READY_TIMEOUT_MS,
): Promise<NonNullable<typeof Office> | null> {
  try {
    await loadOfficeScript();
  } catch {
    return null;
  }

  const office = getOffice();
  if (!office?.onReady) return null;

  const waitMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : READY_TIMEOUT_MS;

  return await new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), waitMs);
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
export async function messageParentSafe(
  message: string,
  timeoutMs: number = 4_000,
): Promise<boolean> {
  const office = await whenOfficeReady(timeoutMs);
  if (!office?.context?.ui?.messageParent) return false;
  try {
    office.context.ui.messageParent(message);
    return true;
  } catch {
    return false;
  }
}

const OUTLOOK_SESSION_STORAGE_KEY = "smartcrm.outlook.session-token";
const OUTLOOK_SESSION_HEADER_NAME = "x-smartcrm-outlook-session";
let memoryOutlookSessionToken: string | null = null;
let fetchBridgeInstalled = false;

export function saveOutlookSessionToken(token: string | null | undefined): void {
  const clean = token?.trim() || null;
  memoryOutlookSessionToken = clean;
  if (typeof window === "undefined") return;
  try {
    if (clean) {
      window.sessionStorage.setItem(OUTLOOK_SESSION_STORAGE_KEY, clean);
    } else {
      window.sessionStorage.removeItem(OUTLOOK_SESSION_STORAGE_KEY);
    }
  } catch {
    /* WebKit private mode / restricted storage — in-memory token still works */
  }
}

export function readOutlookSessionToken(): string | null {
  if (memoryOutlookSessionToken) return memoryOutlookSessionToken;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(OUTLOOK_SESSION_STORAGE_KEY)?.trim() || null;
    if (stored) memoryOutlookSessionToken = stored;
    return stored;
  } catch {
    return memoryOutlookSessionToken;
  }
}

function isSameOriginApiUrl(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const resolved = new URL(raw, window.location.origin);
    return (
      resolved.origin === window.location.origin &&
      resolved.pathname.startsWith("/api/")
    );
  } catch {
    return false;
  }
}

/**
 * Installs a same-origin fetch wrapper so Outlook task panes on macOS (WKWebView)
 * and Safari send the claimed session token via header when WebKit ITP blocks cookies.
 */
export function installOutlookSessionFetchBridge(): void {
  if (typeof window === "undefined" || fetchBridgeInstalled) return;
  if (typeof window.fetch !== "function") return;
  fetchBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = readOutlookSessionToken();
    if (!token || !isSameOriginApiUrl(input)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (!headers.has(OUTLOOK_SESSION_HEADER_NAME)) {
      headers.set(OUTLOOK_SESSION_HEADER_NAME, token);
    }
    return originalFetch(input, { ...init, headers });
  };
}
