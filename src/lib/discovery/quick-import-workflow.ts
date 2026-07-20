export type QuickImportStepId =
  | "parsing_text"
  | "company_match"
  | "contact_match"
  | "creating_records";

export const QUICK_IMPORT_STEP_ORDER: QuickImportStepId[] = [
  "parsing_text",
  "company_match",
  "contact_match",
  "creating_records",
];

export const QUICK_IMPORT_STEP_LABELS: Record<QuickImportStepId, string> = {
  parsing_text: "Parsing Text",
  company_match: "Company Match",
  contact_match: "Contact Match",
  creating_records: "Creating Records",
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}
