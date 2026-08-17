"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";

/**
 * Header appearance control — one switch, remembered in this browser.
 * Icon visibility is CSS-driven so the first paint matches the html.dark class.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="relative inline-flex size-8 items-center justify-center border border-carbon-blue/15 bg-white text-carbon-blue transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
    >
      <Sun className="hidden size-4 dark:block" strokeWidth={1.75} />
      <Moon className="block size-4 dark:hidden" strokeWidth={1.75} />
    </button>
  );
}
