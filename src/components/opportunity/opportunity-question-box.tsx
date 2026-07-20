"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { OpportunityAskContext } from "@/lib/opportunity-smartassist-ask";
import { answerOpportunityQuestion } from "@/lib/opportunity-smartassist-ask";
import type { SmartAssistQueryResponse } from "@/types/smartassist-intelligence";
import {
  SmartAssistEmbeddedPanel,
  SmartAssistQueryResult,
} from "@/components/smartassist/smartassist-intelligence-display";
import {
  buildOpportunityAssessmentSummary,
  buildOpportunityInsightCatalog,
} from "@/lib/smartassist-intelligence-layer";
import {
  EDITORIAL_DIVIDER,
  EDITORIAL_INPUT,
  EDITORIAL_PANEL_INSET,
} from "@/lib/editorial-design-system";

export function OpportunityQuestionBox({ context }: { context: OpportunityAskContext }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SmartAssistQueryResponse | null>(null);
  const [pending, setPending] = useState(false);

  const catalog = useMemo(
    () => buildOpportunityInsightCatalog(context.understanding, context.pipeline),
    [context.understanding, context.pipeline],
  );
  const assessment = useMemo(
    () => buildOpportunityAssessmentSummary(context.understanding),
    [context.understanding],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setPending(true);
    window.setTimeout(() => {
      setResult(answerOpportunityQuestion(trimmed, context));
      setPending(false);
    }, 120);
  };

  return (
    <div className="space-y-8">
      <SmartAssistEmbeddedPanel
        insights={catalog.all}
        summary={{
          headline: assessment.headline,
          confidence: assessment.confidence,
          nextAction: assessment.nextAction,
        }}
      />

      <div className={`${EDITORIAL_DIVIDER} pt-8`}>
        <p className="text-[11px] font-medium text-carbon-blue/45">
          Ask about gaps, stakeholders, next steps, or documents
        </p>
        <form onSubmit={handleSubmit} className="relative mt-3">
          <label className="sr-only" htmlFor="opportunity-smartassist-ask">
            Ask SmartCRM about this opportunity
          </label>
          <input
            id="opportunity-smartassist-ask"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask SmartCRM about this opportunity..."
            className={`${EDITORIAL_INPUT} pr-16`}
          />
          <button
            type="submit"
            disabled={pending || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[13px] font-medium text-upcycle-orange transition-colors hover:text-upcycle-orange/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "…" : "Ask"}
          </button>
        </form>

        {result ? (
          <div className={`mt-5 ${EDITORIAL_PANEL_INSET}`}>
            <SmartAssistQueryResult result={result} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
