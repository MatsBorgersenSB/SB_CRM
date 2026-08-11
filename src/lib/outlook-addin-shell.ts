/**
 * Shared Outlook task-pane shell helpers.
 * Keep Sign In reachable even when React never hydrates (Office WebView / Office.js faults).
 */

export function buildOutlookSignInPath(origin?: string): string {
  const base = (origin ?? "").replace(/\/$/, "") || "";
  const complete = `${base}/outlook/auth-complete`;
  return `${base}/auth/signin?callbackUrl=${encodeURIComponent(complete)}`;
}

/** Inline boot script: reveal static Sign In if React never marks the pane ready. */
export const OUTLOOK_HYDRATION_WATCHDOG_MS = 1_500;

export function markOutlookPaneReady(): void {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.setAttribute("data-smartcrm-outlook-ready", "1");
    const fallback = document.getElementById("smartcrm-outlook-signin-fallback");
    if (fallback) {
      fallback.setAttribute("hidden", "");
      fallback.style.display = "none";
    }
  } catch {
    /* ignore */
  }
}

/**
 * Outlook Web (and some Desktop WebViews) stub History so pushState/replaceState
 * are not functions. Next.js App Router calls them on hydrate and crashes:
 *   TypeError: window.history.replaceState is not a function
 * Install no-ops (preserving API shape) BEFORE any Next client code runs.
 */
export function outlookHistoryPolyfillScript(): string {
  return `(function(){
  try {
    var g = typeof window !== "undefined" ? window : null;
    if (!g) return;

    function noop() { return undefined; }

    function ensureHistory() {
      var h = g.history;
      if (!h || typeof h !== "object") {
        try {
          g.history = {
            length: 0,
            state: null,
            scrollRestoration: "auto",
            pushState: noop,
            replaceState: noop,
            go: noop,
            back: noop,
            forward: noop
          };
        } catch (e) {}
        return g.history;
      }
      return h;
    }

    function installMethod(h, name) {
      var current = null;
      try { current = h[name]; } catch (e) { current = null; }
      if (typeof current === "function") {
        try {
          h[name] = function () {
            try { return current.apply(h, arguments); } catch (e) { return undefined; }
          };
          return;
        } catch (e) {}
      }
      try {
        h[name] = noop;
        if (typeof h[name] === "function") return;
      } catch (e) {}
      try {
        Object.defineProperty(h, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: noop
        });
      } catch (e) {}
    }

    var historyObj = ensureHistory();
    if (!historyObj) return;

    installMethod(historyObj, "pushState");
    installMethod(historyObj, "replaceState");
    installMethod(historyObj, "go");
    installMethod(historyObj, "back");
    installMethod(historyObj, "forward");

    try {
      var stateOk = true;
      try { void historyObj.state; } catch (e) { stateOk = false; }
      if (!stateOk) {
        Object.defineProperty(historyObj, "state", {
          configurable: true,
          enumerable: true,
          get: function () { return null; }
        });
      }
    } catch (e) {}

    // popstate: ensure listeners never see a broken History during Next routing
    try {
      var add = g.addEventListener;
      if (typeof add === "function") {
        g.addEventListener("popstate", function () { /* Outlook stub-safe */ }, false);
      }
    } catch (e) {}

    try {
      g.__SMARTCRM_OUTLOOK_HISTORY_POLYFILL__ = 1;
    } catch (e) {}
  } catch (e) {}
})();`;
}

export function outlookHydrationWatchdogScript(timeoutMs = OUTLOOK_HYDRATION_WATCHDOG_MS): string {
  return `(function(){
  try {
    var readyAttr = "data-smartcrm-outlook-ready";
    var fallbackId = "smartcrm-outlook-signin-fallback";
    window.setTimeout(function () {
      if (document.documentElement.getAttribute(readyAttr) === "1") return;
      var el = document.getElementById(fallbackId);
      if (!el) return;
      el.hidden = false;
      el.style.display = "flex";
      var connecting = document.querySelectorAll("[data-smartcrm-connecting]");
      for (var i = 0; i < connecting.length; i++) {
        connecting[i].setAttribute("hidden", "");
        connecting[i].style.display = "none";
      }
    }, ${Math.max(500, timeoutMs | 0)});
  } catch (e) {}
})();`;
}
