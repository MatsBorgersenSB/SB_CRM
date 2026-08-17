export const THEME_STORAGE_KEY = "smartcrm-theme";

export type ThemePreference = "light" | "dark";

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode / blocked storage */
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(stored: ThemePreference | null): ThemePreference {
  if (stored) return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyThemeClass(theme: ThemePreference): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/** Runs before paint so the first frame matches the stored / OS preference. */
export function themeBootScript(): string {
  return `(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();`;
}
