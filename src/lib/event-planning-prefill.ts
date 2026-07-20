import type { CompanyIndustry } from "@/types/company";

const STORAGE_KEY = "smartcrm-event-company-prefill";

export type EventCompanyPrefill = {
  Title: string;
  Domain?: string;
  Industry?: CompanyIndustry;
  City?: string;
  Phone?: string;
  sourceEventId?: string;
  sourceProspectId?: string;
};

export function stashEventCompanyPrefill(prefill: EventCompanyPrefill): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
}

export function consumeEventCompanyPrefill(): EventCompanyPrefill | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as EventCompanyPrefill;
  } catch {
    return null;
  }
}
