"use client";

import type {
  InsightCategory,
  SmartAssistInsight,
  SmartAssistQueryResponse,
  SmartAssistUnknownResponse,
} from "@/types/smartassist-intelligence";
import { INSIGHT_CATEGORY_LABELS } from "@/types/smartassist-intelligence";
import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CATEGORY_STYLES: Record<InsightCategory, string> = {
  known: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/70",
  assumed: "border-upcycle-orange/20 bg-upcycle-orange/[0.06] text-upcycle-orange/90",
  unknown: "border-carbon-blue/12 bg-carbon-blue/[0.02] text-carbon-blue/55",
  missing_critical: "border-thermal-red/25 bg-thermal-red/[0.04] text-thermal-red/90",
};

export function SmartAssistCategoryBadge({
  category,
}: {
  category: InsightCategory;
}) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${CATEGORY_STYLES[category]}`}
    >
      {INSIGHT_CATEGORY_LABELS[category]}
    </span>
  );
}

export function SmartAssistConfidenceLabel({
  confidence,
}: {
  confidence: ConfidenceLevel;
}) {
  return (
    <span className="text-[10px] font-medium text-carbon-blue/40">
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

export function SmartAssistInsightRow({ insight }: { insight: SmartAssistInsight }) {
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {insight.topic ? (
          <span className="text-[11px] font-medium text-carbon-blue/45">{insight.topic}</span>
        ) : null}
        <SmartAssistCategoryBadge category={insight.category} />
        <SmartAssistConfidenceLabel confidence={insight.confidence} />
      </div>
      <p className="text-[14px] leading-relaxed text-carbon-blue/80">{insight.statement}</p>
      {insight.confidenceReason ? (
        <p className="text-[12px] leading-relaxed text-carbon-blue/45">
          {insight.confidenceReason}
        </p>
      ) : null}
    </li>
  );
}

export function SmartAssistUnknownBlock({
  unknown,
}: {
  unknown: SmartAssistUnknownResponse;
}) {
  return (
    <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
      <p className="text-[14px] font-medium text-carbon-blue">{unknown.statement}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-carbon-blue/65">{unknown.why}</p>
      {unknown.missingInformation.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-carbon-blue/45">Missing information</p>
          <ul className="mt-1 space-y-1">
            {unknown.missingInformation.map((item) => (
              <li key={item} className="text-[13px] text-carbon-blue/70">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {unknown.askNext.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-carbon-blue/45">Ask next</p>
          <ul className="mt-1 space-y-1">
            {unknown.askNext.map((item) => (
              <li key={item} className="text-[13px] text-carbon-blue/70">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function SmartAssistQueryResult({ result }: { result: SmartAssistQueryResponse }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SmartAssistCategoryBadge category={result.primaryCategory} />
        <SmartAssistConfidenceLabel confidence={result.confidence} />
      </div>
      <p className="text-[15px] font-medium leading-snug text-carbon-blue">{result.headline}</p>

      {result.unknown ? <SmartAssistUnknownBlock unknown={result.unknown} /> : null}

      {result.insights.length > 0 ? (
        <ul className="space-y-4">
          {result.insights.map((insight) => (
            <SmartAssistInsightRow key={insight.id} insight={insight} />
          ))}
        </ul>
      ) : null}

      {result.suggestedQuestions.length > 0 ? (
        <div className="border-t border-carbon-blue/8 pt-3">
          <p className="text-[11px] font-medium text-carbon-blue/45">Suggested questions</p>
          <ul className="mt-2 space-y-1">
            {result.suggestedQuestions.map((question) => (
              <li key={question} className="text-[13px] text-carbon-blue/70">
                {question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function SmartAssistEmbeddedPanel({
  insights,
  summary,
}: {
  insights: SmartAssistInsight[];
  summary: {
    headline: string;
    confidence: ConfidenceLevel;
    nextAction: SmartAssistInsight;
  };
}) {
  const missing = insights.filter((item) => item.category === "missing_critical");
  const assumed = insights.filter((item) => item.category === "assumed");
  const known = insights.filter((item) => item.category === "known");
  const unknown = insights.filter((item) => item.category === "unknown");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium text-carbon-blue/45">SmartAssist assessment</p>
        <p className="mt-2 text-[16px] font-medium leading-snug text-carbon-blue">
          {summary.headline}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SmartAssistConfidenceLabel confidence={summary.confidence} />
          <SmartAssistCategoryBadge category={summary.nextAction.category} />
        </div>
        <p className="mt-2 text-[13px] text-carbon-blue/55">
          {summary.nextAction.confidenceReason}
        </p>
      </div>

      {missing.length > 0 ? (
        <InsightGroup title="Missing critical information" items={missing} />
      ) : null}
      {known.length > 0 ? <InsightGroup title="Known" items={known.slice(0, 4)} /> : null}
      {assumed.length > 0 ? (
        <InsightGroup title="Assumed — validate before relying on these" items={assumed.slice(0, 3)} />
      ) : null}
      {unknown.length > 0 ? (
        <InsightGroup title="Unknown" items={unknown.slice(0, 4)} />
      ) : null}
    </div>
  );
}

function InsightGroup({ title, items }: { title: string; items: SmartAssistInsight[] }) {
  return (
    <section>
      <p className="text-[11px] font-medium text-carbon-blue/45">{title}</p>
      <ul className="mt-3 space-y-3">
        {items.map((insight) => (
          <SmartAssistInsightRow key={insight.id} insight={insight} />
        ))}
      </ul>
    </section>
  );
}
