"use client";

import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  readStoredDateFormat,
  readStoredTimeFormat,
  setActiveRegionalFormat,
  subscribeRegionalFormat,
} from "@/lib/regional-format-preference";

/**
 * Keeps the date/time preference in sync with the plain `formatDate` helpers.
 * The server snapshot is the default format, so hydration always matches; when the
 * stored choice differs (or changes), the subtree re-mounts once so every date
 * label re-renders in the chosen format.
 */
export function RegionalFormatProvider({ children }: { children: ReactNode }) {
  const dateFormat = useSyncExternalStore(subscribeRegionalFormat, readStoredDateFormat, () => DEFAULT_DATE_FORMAT);
  const timeFormat = useSyncExternalStore(subscribeRegionalFormat, readStoredTimeFormat, () => DEFAULT_TIME_FORMAT);

  setActiveRegionalFormat(dateFormat, timeFormat);

  return <Fragment key={`${dateFormat}|${timeFormat}`}>{children}</Fragment>;
}
