"use client";

import { useMemo } from "react";
import { AssistantRecommendationCard } from "@/components/administration/assistant-recommendation-card";
import { analyzeContactLifecycle, toActionableInsight } from "@/lib/contact-lifecycle-engine";
import { CONTACT_RELATIONSHIP_INTELLIGENCE } from "@/lib/smart-assist-config";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";

export function ContactLifecycleInsights({
  contact,
  companyId,
  companyName,
  companies,
  pipelines,
  activities,
  showBanner = true,
}: {
  contact: Contact;
  companyId: string;
  companyName: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  showBanner?: boolean;
}) {
  const audit = useMemo(
    () =>
      analyzeContactLifecycle(contact, companyId, companyName, {
        companies,
        pipelines,
        activities,
      }),
    [contact, companyId, companyName, companies, pipelines, activities],
  );

  return (
    <div className="flex flex-col gap-3">
      {showBanner ? (
        <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-3 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
            SmartAssist · {CONTACT_RELATIONSHIP_INTELLIGENCE.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">{audit.summary}</p>
          <p className="mt-1 text-[10px] italic text-carbon-blue/50">
            {CONTACT_RELATIONSHIP_INTELLIGENCE.mantra}
          </p>
        </div>
      ) : audit.summary ? (
        <p className="text-[11px] leading-relaxed text-carbon-blue/65">{audit.summary}</p>
      ) : null}

      {audit.insights.length === 0 ? (
        <p className="px-1 text-xs text-carbon-blue/50">
          No lifecycle signals detected — relationship appears stable.
        </p>
      ) : (
        audit.insights.map((insight) => (
          <AssistantRecommendationCard
            key={insight.id}
            recommendation={toActionableInsight(insight)}
          />
        ))
      )}
    </div>
  );
}
