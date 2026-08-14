import type { Activity } from "@/types/activity";
import type {
  CompleteCommitmentMode,
  CompleteCommitmentRequest,
} from "@/lib/complete-commitment";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { readResponseBody } from "@/services/sharepoint/client/response-body";

export type CompleteCommitmentResult = {
  activity: Activity;
  mode: CompleteCommitmentMode;
};

const DISMISS_PREFIX = "smartcrm:dismiss-commitment:";
const dismissListeners = new Set<() => void>();

function dismissKey(activityId: string): string {
  return `${DISMISS_PREFIX}${activityId}`;
}

function emitDismissals(): void {
  dismissListeners.forEach((listener) => listener());
}

export function subscribeCommitmentDismissals(listener: () => void): () => void {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

export function isCommitmentDismissed(activityId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(dismissKey(activityId)) === "1";
  } catch {
    return false;
  }
}

export function dismissCommitmentInView(activityId: string): void {
  if (!activityId) return;
  try {
    window.sessionStorage.setItem(dismissKey(activityId), "1");
  } catch {
    /* private mode */
  }
  emitDismissals();
}

export async function completeCommitmentInPlace(
  input: CompleteCommitmentRequest,
): Promise<CompleteCommitmentResult> {
  const response = await fetch("/api/commitments/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await readResponseBody(response);

  if (!response.ok) {
    throw SharePointServiceError.fromResponse(response, payload);
  }

  const body = payload as CompleteCommitmentResult | null;
  if (!body?.activity) {
    throw new Error("Commitment update did not return a record.");
  }

  return body;
}
