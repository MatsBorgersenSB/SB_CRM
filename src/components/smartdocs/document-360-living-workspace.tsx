"use client";

import Link from "next/link";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { Document360LinkedTab } from "@/components/smartdocs/tabs/document-360-linked-tab";
import { Document360IntelligenceTab } from "@/components/smartdocs/tabs/document-360-intelligence-tab";
import { DocumentWorkspaceHeader } from "@/components/smartdocs/document-workspace-header";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import type { AttentionItem } from "@/types/attention-item";

export function Document360LivingWorkspace({
  snapshot,
  attentionItems = [],
  onDocumentDelete,
}: {
  snapshot: Document360Snapshot;
  attentionItems?: AttentionItem[];
  onDocumentDelete?: () => Promise<void>;
}) {
  const { businessContext, intelligence, relatedGroups } = snapshot;
  const nba = intelligence.nextBestAction;
  const showLead = intelligence.risks.length > 0 || nba.priority !== "Low";

  const contextItems: Array<{
    label: string;
    value: string;
    href?: string;
    mono?: boolean;
  }> =
    businessContext.ownershipKind === "company"
      ? [
          {
            label: "Company",
            value: businessContext.clientName,
            href: businessContext.clientHref,
          },
          {
            label: "Origin",
            value:
              [businessContext.originLabel, businessContext.counterparty]
                .filter(Boolean)
                .join(" · ") || "Company knowledge",
          },
          {
            label: "SharePoint path",
            value:
              businessContext.sharePointPath ||
              `/Companies/${businessContext.clientName}/Documents`,
            mono: true,
          },
          {
            label: "Owner code",
            value: businessContext.plNumber,
            mono: true,
          },
        ]
      : businessContext.ownershipKind === "project"
        ? [
            {
              label: "Project",
              value: businessContext.projectName ?? businessContext.dealName,
              href: businessContext.projectHref,
            },
            {
              label: "Company",
              value: businessContext.clientName,
              href: businessContext.clientHref,
            },
            {
              label: "Origin",
              value:
                [businessContext.originLabel, businessContext.counterparty]
                  .filter(Boolean)
                  .join(" · ") || "Project document",
            },
            {
              label: "Project code",
              value: businessContext.plNumber,
              mono: true,
            },
          ]
        : [
            {
              label: "Opportunity",
              value: businessContext.dealName,
              href: businessContext.dealHref,
            },
            {
              label: "Client",
              value: businessContext.clientName,
              href: businessContext.clientHref,
            },
            {
              label: "Stage",
              value: businessContext.commercialStage,
            },
            {
              label: "PL Number",
              value: businessContext.plNumber,
              mono: true,
            },
          ];

  return (
    <WorkspaceStack>
      <WorkspacePanel title="Document">
        <DocumentWorkspaceHeader
          snapshot={snapshot}
          onDocumentDelete={onDocumentDelete}
        />
      </WorkspacePanel>

      {showLead ? (
        <IntelligenceLead
          eyebrow="Next best action"
          title={nba.action}
          summary={`${nba.reason}. ${intelligence.insights.businessImpact}`}
          vitals={[
            {
              label: "Impact",
              value: intelligence.insights.businessImpactLevel,
              highlight:
                intelligence.insights.businessImpactLevel === "Critical" ||
                intelligence.insights.businessImpactLevel === "High",
            },
            ...(intelligence.risks.length > 0
              ? [
                  {
                    label: "Risks",
                    value: String(intelligence.risks.length),
                    highlight: true,
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      <WorkspacePanel title="Business Context">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {contextItems.map((item) => (
            <div key={item.label}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/55">
                {item.label}
              </p>
              {item.href ? (
                <Link
                  href={item.href}
                  className="mt-1 inline-block text-sm font-semibold text-carbon-blue hover:text-upcycle-orange"
                >
                  {item.value}
                </Link>
              ) : (
                <p
                  className={`mt-1 text-sm ${
                    item.mono
                      ? "truncate font-mono text-carbon-blue/65"
                      : "text-carbon-blue/75"
                  }`}
                  title={item.value}
                >
                  {item.value}
                </p>
              )}
            </div>
          ))}
        </div>
        {snapshot.documentSet ? (
          <p className="mt-4 text-sm text-carbon-blue/60">
            Document set{" "}
            <Link
              href={snapshot.memberOfHref ?? "#"}
              className="font-semibold text-upcycle-orange hover:underline"
            >
              {snapshot.memberOf ?? snapshot.documentSet.documentSetId}
            </Link>
          </p>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title="Stakeholders & Links" id="linked">
        <Document360LinkedTab snapshot={snapshot} />
      </WorkspacePanel>

      {relatedGroups.length > 0 ? (
        <WorkspacePanel
          title="Related Documents"
          count={relatedGroups.reduce((sum, g) => sum + g.documents.length, 0)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {relatedGroups.map((group) => (
              <div key={group.id}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/55">
                  {group.label}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {group.documents.slice(0, 5).map((doc) => (
                    <li key={doc.id} className="min-w-0">
                      <Link
                        href={doc.href}
                        className="block truncate text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
                      >
                        {doc.name}
                      </Link>
                      {doc.meta ? (
                        <p className="truncate text-[12px] text-carbon-blue/55">
                          {doc.meta}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel title="Intelligence & History" id="intelligence">
        <Document360IntelligenceTab snapshot={snapshot} />
      </WorkspacePanel>

      {attentionItems.length > 0 ? (
        <WorkspacePanel title="Attention" id="attention" count={attentionItems.length}>
          <AttentionQueueTable
            items={attentionItems}
            emptyMessage="No open attention items for this document."
          />
        </WorkspacePanel>
      ) : null}
    </WorkspaceStack>
  );
}
