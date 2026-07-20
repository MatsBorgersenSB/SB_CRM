"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import type { ActivityActionContext } from "@/types/activity-action-context";
import {
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import { SmartAssistCategoryBadge } from "@/components/smartassist/smartassist-intelligence-display";
import { shouldShowActionContext } from "@/lib/activity-action-context";
import { WORKSPACE_CONTEXT_BLOCKS_GRID } from "@/lib/workspace-design-system";

export function ActivityWorkspaceContextSidebar({ context }: { context: ActivityActionContext }) {
  if (!shouldShowActionContext(context)) {
    return (
      <aside className="rounded-lg border border-carbon-blue/8 bg-carbon-blue/[0.02] px-4 py-5">
        <p className={EDITORIAL_LABEL}>Signals</p>
        <p className={`mt-2 ${EDITORIAL_META}`}>
          No signals surfaced for this decision — insufficient linked context.
        </p>
      </aside>
    );
  }

  return (
    <aside>
      <p className={EDITORIAL_LABEL}>Signals</p>
      <p className={`mt-1 ${EDITORIAL_META}`}>Documents and activities affecting this decision — not everything.</p>

      <div className={`mt-5 ${WORKSPACE_CONTEXT_BLOCKS_GRID}`}>
        {context.documents.length > 0 ? (
          <SidebarBlock
            title="Most relevant documents"
            viewAllHref={context.viewAllDocumentsHref}
            viewAllLabel="Browse all"
          >
            {context.documents.map((doc) => (
              <SidebarItem
                key={doc.id}
                title={doc.name}
                titleHref={doc.href}
                detail={doc.whyRelevant}
                category={doc.insightCategory}
              />
            ))}
          </SidebarBlock>
        ) : null}

        {context.activities.length > 0 ? (
          <SidebarBlock
            title="Activities affecting this decision"
            viewAllHref={context.viewAllActivitiesHref}
            viewAllLabel="Browse all"
          >
            {context.activities.map((item) => (
              <SidebarItem
                key={item.id}
                title={item.subject}
                titleHref={item.href}
                meta={item.dateLabel}
                detail={item.whyRelevant}
                category={item.insightCategory}
              />
            ))}
          </SidebarBlock>
        ) : null}

        {context.contacts.length > 0 ? (
          <SidebarBlock title="Related contacts">
            {context.contacts.map((contact) => (
              <div key={contact.contactId} className="space-y-1">
                <p className="text-[13px] font-medium text-carbon-blue">{contact.name}</p>
                <MetaLine label="Role" value={contact.role} />
                <MetaLine label="Relationship" value={contact.relationship} />
                <Link
                  href={contact.href}
                  className="inline-block pt-1 text-[11px] font-semibold text-upcycle-orange hover:underline"
                >
                  View contact
                </Link>
              </div>
            ))}
          </SidebarBlock>
        ) : null}

        {context.opportunity ? (
          <SidebarBlock title="Related opportunity">
            <p className="text-[13px] font-medium text-carbon-blue">{context.opportunity.name}</p>
            <div className="mt-2 space-y-1">
              <MetaLine label="Status" value={context.opportunity.status} />
              <MetaLine label="Attention" value={context.opportunity.attentionLevel} />
              <MetaLine label="Biggest unknown" value={context.opportunity.biggestUnknown} />
            </div>
            <Link
              href={context.opportunity.href}
              className="mt-2 inline-block text-[11px] font-semibold text-upcycle-orange hover:underline"
            >
              Open opportunity
            </Link>
          </SidebarBlock>
        ) : null}

        {context.decisions.length > 0 ? (
          <SidebarBlock title="Related decisions">
            {context.decisions.map((decision) => (
              <SidebarItem key={decision.text} title={decision.text} detail={decision.whyRelevant} />
            ))}
          </SidebarBlock>
        ) : null}
      </div>
    </aside>
  );
}

function SidebarBlock({
  title,
  children,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  children: ReactNode;
  viewAllHref?: string | null;
  viewAllLabel?: string;
}) {
  return (
    <section className="rounded-lg border border-carbon-blue/8 bg-white px-4 py-3.5">
      <h3 className={EDITORIAL_FIELD_LABEL}>{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
      {viewAllHref && viewAllLabel ? (
        <Link
          href={viewAllHref}
          className="mt-3 inline-block text-[11px] font-semibold text-upcycle-orange hover:underline"
        >
          {viewAllLabel}
        </Link>
      ) : null}
    </section>
  );
}

function SidebarItem({
  title,
  titleHref,
  meta,
  detail,
  category,
}: {
  title: string;
  titleHref?: string | null;
  meta?: string;
  detail: string;
  category?: InsightCategory;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {titleHref ? (
          <Link
            href={titleHref}
            className="text-[13px] font-medium leading-snug text-carbon-blue hover:text-upcycle-orange"
          >
            {title}
          </Link>
        ) : (
          <p className="text-[13px] font-medium leading-snug text-carbon-blue">{title}</p>
        )}
        {category ? <SmartAssistCategoryBadge category={category} /> : null}
      </div>
      {meta ? <p className={`mt-0.5 ${EDITORIAL_META}`}>{meta}</p> : null}
      <p className={`mt-1 ${EDITORIAL_META} leading-snug`}>{detail}</p>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <p className={EDITORIAL_META}>
      <span className="text-carbon-blue/40">{label}: </span>
      <span className="text-carbon-blue/70">{value}</span>
    </p>
  );
}