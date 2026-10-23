"use client";

import { SmartAssistCopilotPanel } from "@/components/smartassist/smart-assist-copilot-view";
import { dedupeByCompany, TODAY_PROPOSALS_VISIBLE } from "@/lib/attention-focus";
import { useSmartAssist } from "@/context/smart-assist-context";

/**
 * Surfaces Active Assist — prepare activities, reminders, record updates.
 * SmartAssist prepares; the user decides. FS-013 Active Operating Loop.
 */
export function SmartAssistCopilotHost({
  companyName,
  compact = false,
}: {
  /** When set, only show proposals for this account. */
  companyName?: string;
  /** Today: one proposal per company, only the top few. */
  compact?: boolean;
}) {
  const { focus, refresh, visible, loading } = useSmartAssist();

  if (!visible || loading) return null;

  let proposals = focus?.copilotProposals ?? [];
  if (companyName?.trim()) {
    const needle = companyName.trim().toLowerCase();
    proposals = proposals.filter(
      (proposal) => proposal.companyName?.trim().toLowerCase() === needle,
    );
  } else if (compact) {
    // Portfolio view: one proposal per company, only the few that matter most.
    proposals = dedupeByCompany(proposals).slice(0, TODAY_PROPOSALS_VISIBLE);
  }

  if (proposals.length === 0) return null;

  return (
    <SmartAssistCopilotPanel
      proposals={proposals}
      onRefresh={refresh}
      onNavigate={() => undefined}
    />
  );
}
