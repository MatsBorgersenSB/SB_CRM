import type { Company360RiskSignal } from "@/lib/company-360-data";
import type { DealRiskSignal } from "@/lib/opportunity-intelligence-engine";
import type {
  M365ActionBlock,
  M365RiskBlock,
  M365Severity,
} from "@/types/m365";
import { company360Href } from "@/types/company-360";
import type { RecommendedAction } from "@/lib/next-best-action-engine";
import { ensureImpact } from "@/lib/m365/meta";

export function toM365RiskFromCompanySignal(signal: Company360RiskSignal): M365RiskBlock {
  return {
    id: signal.id,
    label: signal.label,
    detail: signal.detail,
    severity: signal.severity,
    impact: ensureImpact(signal.impact, signal.detail),
  };
}

export function toM365RiskFromDealSignal(
  signal: DealRiskSignal,
  dealValueImpact: string,
): M365RiskBlock {
  return {
    id: signal.id,
    label: signal.label,
    detail: signal.detail,
    severity: signal.severity,
    impact: ensureImpact([dealValueImpact, signal.detail], signal.label),
  };
}

export function toM365Action(
  action: RecommendedAction,
  companyId: string,
  extraImpact: string[] = [],
): M365ActionBlock {
  return {
    id: action.id ?? action.ruleId,
    action: action.action,
    priority: action.priority,
    impact: ensureImpact([action.reason, ...extraImpact], action.reason),
    href: company360Href(companyId),
    plannerEligible: action.priority === "High" || action.priority === "Medium",
  };
}

export function toM365ActionFromFields(input: {
  id: string;
  action: string;
  reason: string;
  priority: M365ActionBlock["priority"];
  href: string;
  extraImpact?: string[];
}): M365ActionBlock {
  return {
    id: input.id,
    action: input.action,
    priority: input.priority,
    impact: ensureImpact([input.reason, ...(input.extraImpact ?? [])], input.reason),
    href: input.href,
    plannerEligible: input.priority === "High" || input.priority === "Medium",
  };
}

export function pickTopRisk(risks: M365RiskBlock[]): M365RiskBlock | null {
  if (risks.length === 0) return null;

  const rank: Record<M365Severity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...risks].sort((a, b) => rank[a.severity] - rank[b.severity])[0] ?? null;
}
