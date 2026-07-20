"use client";

import Link from "next/link";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { Document360LinkedTab } from "@/components/smartdocs/tabs/document-360-linked-tab";
import { DocumentWorkspaceHeader } from "@/components/smartdocs/document-workspace-header";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import type { AttentionItem } from "@/types/attention-item";

export function Document360LivingWorkspace({
  snapshot,
  attentionItems = [],
}: {
  snapshot: Document360Snapshot;
  attentionItems?: AttentionItem[];
}) {
  const { businessContext } = snapshot;

  return (
    <WorkspaceStack>
      <WorkspacePanel title="Document">
        <DocumentWorkspaceHeader snapshot={snapshot} />
      </WorkspacePanel>

      <WorkspacePanel title="Business Context">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/55">Opportunity</p>
            <p className="mt-1 text-sm font-semibold text-carbon-blue">{businessContext.dealName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/55">Client</p>
            <p className="mt-1 text-sm text-carbon-blue/75">{businessContext.clientName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/55">Stage</p>
            <p className="mt-1 text-sm text-carbon-blue/75">{businessContext.commercialStage}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/55">PL Number</p>
            <p className="mt-1 font-mono text-sm text-carbon-blue/65">{businessContext.plNumber}</p>
          </div>
        </div>
        {snapshot.documentSet ? (
          <p className="mt-4 text-sm text-carbon-blue/60">
            Document set{" "}
            <Link href={snapshot.memberOfHref ?? "#"} className="font-semibold text-upcycle-orange hover:underline">
              {snapshot.memberOf ?? snapshot.documentSet.documentSetId}
            </Link>
          </p>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title="Stakeholders" id="linked">
        <Document360LinkedTab snapshot={snapshot} />
      </WorkspacePanel>

      <WorkspacePanel title="Attention" id="attention">
        <AttentionQueueTable
          items={attentionItems}
          emptyMessage="No open attention items for this document."
        />
      </WorkspacePanel>
    </WorkspaceStack>
  );
}
