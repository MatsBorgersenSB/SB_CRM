import Link from "next/link";
import { Sparkles } from "lucide-react";
import type {
  CopilotBriefing,
  CopilotBriefItem,
  CopilotRecommendation,
} from "@/types/smartcrm-copilot";
import { getCopilotExplanation } from "@/lib/smartcrm-copilot-engine";
import { NEXT_BEST_ACTION_PRIORITY_STYLES } from "@/lib/next-best-action-engine";

function SeverityDot({ severity }: { severity?: CopilotBriefItem["severity"] }) {
  const color =
    severity === "critical"
      ? "bg-red-500"
      : severity === "warning"
        ? "bg-upcycle-orange"
        : "bg-carbon-blue/30";
  return <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${color}`} />;
}

function BriefItemRow({ item }: { item: CopilotBriefItem }) {
  const content = (
    <>
      <SeverityDot severity={item.severity} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-carbon-blue">{item.label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-blue/50">{item.detail}</p>
      </div>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="flex gap-2 rounded-sm px-1 py-1.5 transition-colors hover:bg-carbon-blue/[0.03]"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex gap-2 px-1 py-1.5">{content}</div>;
}

function RecommendationRow({ rec }: { rec: CopilotRecommendation }) {
  const inner = (
    <div
      className={`border px-3 py-2.5 ${NEXT_BEST_ACTION_PRIORITY_STYLES[rec.priority]}`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
        {rec.priority} priority
      </p>
      <p className="mt-0.5 text-[11px] font-semibold">{rec.action}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed opacity-80">{rec.reason}</p>
    </div>
  );

  if (rec.href) {
    return (
      <Link href={rec.href} className="block transition-opacity hover:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}

function CopilotSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: CopilotBriefItem[];
  empty?: string;
}) {
  if (items.length === 0) {
    return empty ? (
      <div>
        <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
          {title}
        </h3>
        <p className="mt-1.5 text-[10px] text-carbon-blue/40">{empty}</p>
      </div>
    ) : null;
  }

  return (
    <div>
      <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        {title}
      </h3>
      <ul className="mt-2 space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <BriefItemRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationsSection({ recs }: { recs: CopilotRecommendation[] }) {
  if (recs.length === 0) return null;
  return (
    <div>
      <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        Recommended actions
      </h3>
      <div className="mt-2 space-y-2">
        {recs.map((rec, i) => (
          <RecommendationRow key={`${rec.action}-${i}`} rec={rec} />
        ))}
      </div>
    </div>
  );
}

function DailyBriefingView({ briefing }: { briefing: Extract<CopilotBriefing, { kind: "daily" }> }) {
  return (
    <>
      <CopilotSection
        title="Relationships requiring attention"
        items={briefing.relationshipsAttention}
        empty="All relationships within healthy thresholds."
      />
      <CopilotSection
        title="Opportunities at risk"
        items={briefing.opportunitiesAtRisk}
        empty="No deals flagged at risk."
      />
      <CopilotSection
        title="Knowledge risks"
        items={briefing.knowledgeRisks}
        empty="No document knowledge risks detected."
      />
      <RecommendationsSection recs={briefing.recommendedFocus} />
    </>
  );
}

function CompanyBriefingView({
  briefing,
}: {
  briefing: Extract<CopilotBriefing, { kind: "company" }>;
}) {
  return (
    <>
      <p className="text-[11px] leading-relaxed text-carbon-blue/60">
        {briefing.relationshipSummary}
      </p>
      <div className="flex gap-4 text-[10px]">
        <span className="font-semibold tabular-nums text-carbon-blue">
          Health {briefing.healthScore}
        </span>
        <span className="text-carbon-blue/45">{briefing.healthStatus}</span>
      </div>
      <CopilotSection title="Risks" items={briefing.risks} empty="No active risk signals." />
      <CopilotSection
        title="Open commitments"
        items={briefing.openCommitments}
        empty="No open commitments."
      />
      <CopilotSection
        title="Activity memory"
        items={briefing.activityMemory}
        empty="No recent activity memory captured."
      />
      <RecommendationsSection recs={briefing.recommendedActions} />
    </>
  );
}

function OpportunityBriefingView({
  briefing,
}: {
  briefing: Extract<CopilotBriefing, { kind: "opportunity" }>;
}) {
  return (
    <>
      {!briefing.portfolioMode && briefing.healthScore !== undefined ? (
        <div className="flex flex-wrap gap-3 text-[10px]">
          <span className="font-semibold tabular-nums text-carbon-blue">
            Health {briefing.healthScore}
          </span>
          {briefing.winProbability !== undefined ? (
            <span className="text-carbon-blue/55">{briefing.winProbability}% win probability</span>
          ) : null}
          {briefing.momentum ? (
            <span className="text-carbon-blue/55">{briefing.momentum} momentum</span>
          ) : null}
        </div>
      ) : null}
      <CopilotSection
        title={briefing.portfolioMode ? "Portfolio at risk" : "Deal risks"}
        items={briefing.portfolioMode ? briefing.opportunitiesAtRisk : briefing.risks}
        empty="No opportunity risks detected."
      />
      {briefing.portfolioMode && briefing.risks.length > 0 ? (
        <CopilotSection title="Risk signals" items={briefing.risks} />
      ) : null}
      <RecommendationsSection recs={briefing.recommendedActions} />
    </>
  );
}

function DocumentBriefingView({
  briefing,
}: {
  briefing: Extract<CopilotBriefing, { kind: "document" }>;
}) {
  return (
    <>
      <p className="text-[11px] leading-relaxed text-carbon-blue/60">{briefing.businessImpact}</p>
      <div className="text-[10px] font-semibold text-upcycle-orange">
        {briefing.impactLevel} business impact
      </div>
      <CopilotSection title="Dependencies" items={briefing.dependencies} />
      <CopilotSection title="Risks" items={briefing.risks} empty="No document risks detected." />
      <RecommendationsSection recs={briefing.recommendations} />
    </>
  );
}

const CONTEXT_LABELS: Record<CopilotBriefing["context"], string> = {
  dashboard: "Daily briefing",
  company: "Company summary",
  opportunity: "Opportunity summary",
  document: "Document summary",
};

export function SmartCRMCopilotPanel({ briefing }: { briefing: CopilotBriefing }) {
  const timestamp = new Date(briefing.generatedAt).toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <aside className="dashboard-card flex flex-col overflow-hidden border-l-2 border-upcycle-orange/40">
      <header className="border-b border-carbon-blue/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-upcycle-orange" strokeWidth={1.75} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              SmartCRM Copilot
            </p>
            <p className="text-[11px] font-semibold text-carbon-blue">
              {CONTEXT_LABELS[briefing.context]}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-carbon-blue/65">{briefing.headline}</p>
        <p className="mt-1 text-[9px] text-carbon-blue/35">
          {timestamp} · {briefing.source === "rule" ? "Intelligence engines" : "AI enhanced"}
        </p>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
        {briefing.kind === "daily" ? <DailyBriefingView briefing={briefing} /> : null}
        {briefing.kind === "company" ? <CompanyBriefingView briefing={briefing} /> : null}
        {briefing.kind === "opportunity" ? <OpportunityBriefingView briefing={briefing} /> : null}
        {briefing.kind === "document" ? <DocumentBriefingView briefing={briefing} /> : null}
      </div>

      <footer className="mt-auto border-t border-carbon-blue/8 px-4 py-2.5">
        <p className="text-[9px] leading-relaxed text-carbon-blue/35">{getCopilotExplanation()}</p>
      </footer>
    </aside>
  );
}
