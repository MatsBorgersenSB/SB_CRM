"use client";

import type { CriticalKnowledgeGap, ConfirmedUnderstandingRow } from "@/lib/opportunity-workspace-intelligence";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import {
  EDITORIAL_BODY,
  EDITORIAL_BODY_MUTED,
  EDITORIAL_CONTENT,
  EDITORIAL_DIVIDER,
  EDITORIAL_EMPTY,
  EDITORIAL_GAP_LIST,
  EDITORIAL_GAP_SECTION,
  EDITORIAL_LABEL,
  EDITORIAL_TITLE,
} from "@/lib/editorial-design-system";

const PRIORITY_DOT: Record<CriticalKnowledgeGap["priority"], string> = {
  high: "bg-thermal-red",
  medium: "bg-upcycle-orange",
  low: "bg-carbon-blue/30",
};

function gapCategory(priority: CriticalKnowledgeGap["priority"]): InsightCategory {
  return priority === "high" ? "missing_critical" : "unknown";
}

function confirmedCategory(rowId: string, answer: string): InsightCategory {
  if (rowId === "engagement" || rowId === "buyer" || rowId === "offerings") return "known";
  if (/from opportunity record|appears to be|inferred|directionally|discussed/i.test(answer)) {
    return "assumed";
  }
  if (rowId === "product" || rowId === "scope" || rowId === "role") return "assumed";
  return "known";
}

function confirmedConfidence(category: InsightCategory): "high" | "medium" | "low" {
  return category === "known" ? "high" : "medium";
}

export function OpportunityKnowledgeView({
  criticalGaps,
  confirmedUnderstanding,
  variant = "both",
  onAnswerNow,
}: {
  criticalGaps: CriticalKnowledgeGap[];
  confirmedUnderstanding: ConfirmedUnderstandingRow[];
  variant?: "gaps" | "understanding" | "both";
  onAnswerNow?: (fieldId: string) => void;
}) {
  const showGaps = variant === "gaps" || variant === "both";
  const showUnderstanding = variant === "understanding" || variant === "both";

  return (
    <section aria-label="Opportunity understanding" className="py-1">
      {showGaps ? (
        <div>
          {criticalGaps.length === 0 ? (
            <p className={`${EDITORIAL_CONTENT} ${EDITORIAL_EMPTY}`}>No critical gaps flagged.</p>
          ) : (
            <ul className={EDITORIAL_GAP_LIST}>
              {criticalGaps.map((gap) => {
                const category = gapCategory(gap.priority);
                const canAnswer = Boolean(gap.fieldId && onAnswerNow);
                return (
                  <li key={gap.id} className={`flex ${EDITORIAL_CONTENT} gap-3`}>
                    <span
                      className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[gap.priority]}`}
                      aria-label={`${gap.priority} priority`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SmartAssistCategoryBadge category={category} />
                        <SmartAssistConfidenceLabel
                          confidence={gap.priority === "high" ? "high" : "medium"}
                        />
                      </div>
                      <p className={EDITORIAL_TITLE}>{gap.missingInformation}</p>
                      <p className={EDITORIAL_BODY_MUTED}>{gap.whyItMatters}</p>
                      <p className={EDITORIAL_BODY}>{gap.recommendedAction}</p>
                      {canAnswer ? (
                        <button
                          type="button"
                          onClick={() => onAnswerNow?.(gap.fieldId!)}
                          className="mt-1 inline-flex border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
                        >
                          Answer Now
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {showUnderstanding ? (
        <div className={showGaps ? `${EDITORIAL_GAP_SECTION} ${EDITORIAL_DIVIDER} pt-10` : ""}>
          {confirmedUnderstanding.length === 0 ? (
            <p className={`${EDITORIAL_CONTENT} ${EDITORIAL_EMPTY}`}>
              Confirmed understanding will build as you capture answers.
            </p>
          ) : (
            <ul className={EDITORIAL_GAP_LIST}>
              {confirmedUnderstanding.map((row) => {
                const category = confirmedCategory(row.id, row.answer);
                return (
                  <li key={row.id} className={`${EDITORIAL_CONTENT} space-y-2`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={EDITORIAL_LABEL}>{row.topic}</p>
                      <SmartAssistCategoryBadge category={category} />
                      <SmartAssistConfidenceLabel confidence={confirmedConfidence(category)} />
                    </div>
                    <p className={`${EDITORIAL_BODY} text-carbon-blue`}>{row.answer}</p>
                    {row.fieldId && onAnswerNow ? (
                      <button
                        type="button"
                        onClick={() => onAnswerNow(row.fieldId!)}
                        className="text-[11px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
                      >
                        Edit answer
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
