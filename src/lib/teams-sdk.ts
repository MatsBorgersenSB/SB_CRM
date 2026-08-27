/**
 * Microsoft Teams SDK readiness — load from CDN like Office.js for Outlook.
 * Never touch microsoftTeams.app until initialized.
 */

const TEAMS_SCRIPT =
  "https://res.cdn.office.net/teams-js/2.34.0/js/MicrosoftTeams.min.js";

type TeamsPagesConfig = {
  registerOnSaveHandler: (
    handler: (saveEvent: {
      notifySuccess: () => void;
      notifyFailure: (reason?: string) => void;
    }) => void,
  ) => void;
  setConfig: (config: {
    entityId: string;
    contentUrl: string;
    websiteUrl?: string;
    suggestedDisplayName?: string;
  }) => Promise<void>;
  setValidityState: (valid: boolean) => void;
};

export type TeamsSdk = {
  app: {
    initialize: () => Promise<void>;
    getContext: () => Promise<{
      user?: { userPrincipalName?: string; loginHint?: string };
      chat?: { id?: string };
      meeting?: { id?: string };
      page?: { frameContext?: string };
    }>;
  };
  pages?: {
    config?: TeamsPagesConfig;
  };
};

declare global {
  interface Window {
    microsoftTeams?: TeamsSdk;
  }
}

function getTeams(): TeamsSdk | undefined {
  return typeof window !== "undefined" ? window.microsoftTeams : undefined;
}

function loadTeamsScript(): Promise<void> {
  if (getTeams()?.app?.initialize) return Promise.resolve();
  if (typeof document === "undefined") return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${TEAMS_SCRIPT}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      if (getTeams()?.app?.initialize) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Teams SDK")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TEAMS_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Teams SDK"));
    document.head.appendChild(script);
  });
}

/**
 * Load Teams JS (does not require running inside Teams).
 * Returns null if the script fails or microsoftTeams is missing.
 */
export async function ensureTeamsSdk(): Promise<TeamsSdk | null> {
  try {
    await loadTeamsScript();
  } catch {
    return null;
  }
  return getTeams()?.app?.initialize ? (getTeams() ?? null) : null;
}

/**
 * Resolves when Teams JS is ready and initialized. Returns null outside Teams.
 */
export async function whenTeamsReady(
  timeoutMs = 12_000,
): Promise<TeamsSdk | null> {
  const teams = await ensureTeamsSdk();
  if (!teams?.app?.initialize) return null;

  return await new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    void teams.app
      .initialize()
      .then(() => {
        window.clearTimeout(timer);
        resolve(teams);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function resolveTeamsUserHint(): Promise<string | null> {
  const teams = await whenTeamsReady();
  if (!teams) return null;
  try {
    const context = await teams.app.getContext();
    return (
      context.user?.loginHint?.trim().toLowerCase() ||
      context.user?.userPrincipalName?.trim().toLowerCase() ||
      null
    );
  } catch {
    return null;
  }
}
