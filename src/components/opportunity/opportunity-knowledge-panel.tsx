"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { SmartAssistCopilotHost } from "@/components/smartassist/smart-assist-copilot-host";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { buildSmartDocsIntelligence } from "@/lib/smartdocs-intelligence-data";
import {
  MissingCriticalDocumentRow,
  SmartDocsIntelligenceRow,
} from "@/components/smartdocs/smartdocs-intelligence-row";
import { ActivityTypeIcon } from "@/components/activities/activity-type-icon";
import { formatActivityDateTime, getActivitiesForDeal } from "@/lib/activity-utils";

export function OpportunityKnowledgePanel({
  dealId,
  dealName,
  activities,
  companies,
  pipelines,
  attentionItems,
}: {
  dealId: string;
  dealName: string;
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  attentionItems: AttentionItem[];
}) {
  const smartDocs = useMemo(
    () => buildSmartDocsIntelligence(pipelines, companies, activities),
    [activities, companies, pipelines],
  );

  const dealKnowledge = useMemo(
    () =>
      smartDocs.knowledgeAtRisk.filter(
        (item) => item.document.pipelineId === dealId,
      ),
    [smartDocs, dealId],
  );

  const missingForDeal = useMemo(
    () =>
      smartDocs.missingCriticalDocuments.filter(
        (item) => item.entityKind === "deal" && item.id.includes(dealId),
      ),
    [smartDocs, dealId],
  );

  const knowledgeActivities = useMemo(
    () => getActivitiesForDeal(activities, dealId).slice(0, 8),
    [activities, dealId],
  );

  const companyName = useMemo(
    () => companies.find((company) => company.pipelineIds.includes(dealId))?.Title,
    [companies, dealId],
  );

  return (
    <div className="flex flex-col gap-4">
      <SmartAssistCopilotHost companyName={companyName} />
      <section className="dashboard-card p-4 sm:p-5">
        <header className="mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Knowledge at risk · {dealName}
          </h2>
          <p className="mt-1 text-[11px] text-carbon-blue/50">
            Documents and captured intelligence that could block or slow this opportunity.
          </p>
        </header>
        {dealKnowledge.length === 0 && missingForDeal.length === 0 ? (
          <p className="text-[11px] text-carbon-blue/45">
            No knowledge gaps flagged for this deal.
          </p>
        ) : (
          <div className="space-y-2">
            {dealKnowledge.map((item) => (
              <SmartDocsIntelligenceRow key={item.document.id} item={item} />
            ))}
            {missingForDeal.map((item) => (
              <MissingCriticalDocumentRow key={item.id} item={item} />
            ))}
          </div>
        )}
        <Link
          href="/knowledge"
          className="mt-3 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
        >
          Open full knowledge workspace →
        </Link>
      </section>

      <section className="dashboard-card p-4 sm:p-5">
        <header className="mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Captured activity intelligence
          </h2>
        </header>
        {knowledgeActivities.length === 0 ? (
          <p className="text-[11px] text-carbon-blue/45">
            No activity knowledge captured yet — log an interaction to build deal memory.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {knowledgeActivities.map((activity) => {
              const memory = buildRelationshipMemory(activity);
              return (
                <li key={activity.ActivityID}>
                  <Link
                    href={`/activities/${activity.ActivityID}`}
                    className="flex items-start gap-2.5 rounded-lg border border-carbon-blue/10 px-3 py-2 transition-colors hover:border-upcycle-orange/20 hover:bg-upcycle-orange/[0.02]"
                  >
                    <ActivityTypeIcon type={activity.ActivityType} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-carbon-blue">
                        {activity.Subject}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-carbon-blue/50">
                        {memory.summary}
                      </p>
                      <p className="mt-0.5 text-[9px] text-carbon-blue/35">
                        {formatActivityDateTime(activity.ActivityDate)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {attentionItems.length > 0 ? (
        <section className="dashboard-card p-4 sm:p-5">
          <header className="mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
              Attention items
            </h2>
          </header>
          <AttentionQueueTable
            items={attentionItems}
            emptyMessage="No open attention items for this opportunity."
          />
        </section>
      ) : null}
    </div>
  );
}
