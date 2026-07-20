/** Temporary diagnostics for Outlook contact import pipeline (Phase 1F.6). */

const PREFIX = "[SmartCRM Outlook Import]";

export function isOutlookImportDiagnosticsEnabled(): boolean {
  return (
    process.env.OUTLOOK_IMPORT_DEBUG === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

export function logOutlookImport(stage: string, payload: unknown): void {
  if (!isOutlookImportDiagnosticsEnabled()) return;

  console.log(`${PREFIX} ${stage}`, JSON.stringify(payload, null, 2));
}
