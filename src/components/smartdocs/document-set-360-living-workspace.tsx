"use client";

import Link from "next/link";
import type { DocumentSet360Snapshot } from "@/lib/document-set-engine";
import { DOCUMENT_SET_STATUS_STYLES } from "@/types/document-set";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import type { AttentionItem } from "@/types/attention-item";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";

export function DocumentSet360LivingWorkspace({
  snapshot,
  attentionItems = [],
}: {
  snapshot: DocumentSet360Snapshot;
  attentionItems?: AttentionItem[];
}) {
  const { documentSet, members, completeness } = snapshot;
  const missingMembers = members.filter((member) => !member.present);

  return (
    <WorkspaceStack>
      <WorkspacePanel title="Document Set">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
              <SmartCRMIcon name="documentSet" size="lg" label="Document Set" />
              <span className="truncate">{documentSet.title}</span>
            </h1>
            <p className="mt-2 font-mono text-[11px] text-carbon-blue/50">{documentSet.documentSetId}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DOCUMENT_SET_STATUS_STYLES[documentSet.documentSetStatus]}`}
              >
                {documentSet.documentSetStatus}
              </span>
              <span className="text-sm font-semibold text-carbon-blue">{completeness.score}% complete</span>
            </div>
            {documentSet.summary ? (
              <p className="mt-3 text-sm text-carbon-blue/65">{documentSet.summary}</p>
            ) : null}
          </div>
          <div className="text-right text-[13px] text-carbon-blue/65">
            <p>{documentSet.typeLabel}</p>
            <p>{documentSet.dealId}</p>
            <p>{documentSet.clientName}</p>
          </div>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Documents" id="documents">
        <WorkspaceTable>
          <WorkspaceTableHead>
            <WorkspaceTableHeadRow>
              <WorkspaceTableHeadCell>Document</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Role</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Status</WorkspaceTableHeadCell>
              <WorkspaceTableHeadCell>Open</WorkspaceTableHeadCell>
            </WorkspaceTableHeadRow>
          </WorkspaceTableHead>
          <WorkspaceTableBody>
            {members.map((member) => (
              <WorkspaceTableBodyRow key={member.fileName}>
                <WorkspaceTableBodyCell className="font-medium text-carbon-blue">
                  {member.documentName}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className="text-carbon-blue/65">{member.role}</WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell className={member.present ? "text-carbon-blue/65" : "text-upcycle-orange"}>
                  {member.present ? "In library" : "Missing"}
                </WorkspaceTableBodyCell>
                <WorkspaceTableBodyCell>
                  {member.href ? (
                    <Link href={member.href} className="font-semibold text-upcycle-orange hover:underline">
                      Open
                    </Link>
                  ) : (
                    "—"
                  )}
                </WorkspaceTableBodyCell>
              </WorkspaceTableBodyRow>
            ))}
          </WorkspaceTableBody>
        </WorkspaceTable>

        {missingMembers.length > 0 ? (
          <p className="mt-4 text-sm text-carbon-blue/55">
            {missingMembers.length} document{missingMembers.length === 1 ? "" : "s"} still missing from the library.
          </p>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title="Attention" id="attention">
        <AttentionQueueTable
          items={attentionItems}
          emptyMessage="No open attention items for this document set."
        />
      </WorkspacePanel>
    </WorkspaceStack>
  );
}
