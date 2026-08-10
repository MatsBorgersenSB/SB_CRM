import {
  stashSmartAssistPrefill,
  type SmartAssistActivityPrefill,
} from "@/lib/smart-assist-prefill";
import { markCoPilotProposalApproved } from "@/lib/smartassist-copilot-store";
import type {
  CoPilotActionProposal,
  CoPilotExecuteResult,
} from "@/types/smartassist-copilot";

/**
 * Browser-safe Co-Pilot approve path.
 * Calls the server executor so Prisma / pipeline-db never enter the client bundle.
 */
export async function executeCoPilotProposal(
  proposal: CoPilotActionProposal,
): Promise<CoPilotExecuteResult> {
  const response = await fetch("/api/smartassist/copilot/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposal }),
  });

  const body = (await response.json().catch(() => null)) as
    | CoPilotExecuteResult
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && "error" in body && body.error
        ? body.error
        : "Could not apply recommendation.";
    throw new Error(message);
  }

  const result = body as CoPilotExecuteResult;
  markCoPilotProposalApproved(proposal.id);

  if (result.mode === "navigate" && result.prefill) {
    stashSmartAssistPrefill(result.prefill as SmartAssistActivityPrefill);
  }

  return result;
}
