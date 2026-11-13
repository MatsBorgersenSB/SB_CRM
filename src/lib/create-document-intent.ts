/**
 * Create / upload document from the global Create menu.
 * Documents live on a record — jump there and open Create or Import with an optional type.
 */

export const DOCUMENT_INTENT_EVENT = "smartcrm:document-intent";
export const DOCUMENT_INTENT_PENDING_KEY = "smartcrm:document-intent-pending";

const PENDING_TTL_MS = 10_000;

export type DocumentIntentMode = "create" | "import";

export type DocumentIntent = {
  mode: DocumentIntentMode;
  /** SmartDoc type when mode is create (e.g. Memo, Presentation). */
  type?: string;
};

type PendingPayload = DocumentIntent & { at: number };

export function markDocumentIntent(intent: DocumentIntent): void {
  const payload: PendingPayload = { ...intent, at: Date.now() };
  sessionStorage.setItem(DOCUMENT_INTENT_PENDING_KEY, JSON.stringify(payload));
}

export function consumeDocumentIntent(): DocumentIntent | null {
  const raw = sessionStorage.getItem(DOCUMENT_INTENT_PENDING_KEY);
  if (raw === null) return null;
  sessionStorage.removeItem(DOCUMENT_INTENT_PENDING_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingPayload;
    if (!Number.isFinite(parsed.at) || Date.now() - parsed.at >= PENDING_TTL_MS) {
      return null;
    }
    if (parsed.mode !== "create" && parsed.mode !== "import") return null;
    return {
      mode: parsed.mode,
      type: typeof parsed.type === "string" ? parsed.type : undefined,
    };
  } catch {
    return null;
  }
}

export function dispatchDocumentIntent(intent: DocumentIntent): void {
  markDocumentIntent(intent);
  window.dispatchEvent(new CustomEvent(DOCUMENT_INTENT_EVENT, { detail: intent }));
}
