"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ActivityActionContext } from "@/types/activity-action-context";
import {
  EDITORIAL_BODY,
  EDITORIAL_DIVIDER,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import { shouldShowActionContext } from "@/lib/activity-action-context";

export function ActivityActionContextPanel({ context }: { context: ActivityActionContext }) {
  if (!shouldShowActionContext(context)) return null;

  return (
    <section className={`mt-10 ${EDITORIAL_DIVIDER} pt-10`}>
      <p className={EDITORIAL_LABEL}>Context before action</p>
      <p className={`mt-2 ${EDITORIAL_META}`}>
        What you need to execute the recommended step — without searching.
      </p>

      <div className="mt-8 space-y-10">
        {context.documents.length > 0 ? (
          <ContextBlock
            title="Relevant documents"
            viewAllHref={context.viewAllDocumentsHref}
            viewAllLabel="View all documents"
          >
            {context.documents.map((doc) => (
              <ContextItem
                key={doc.id}
                title={doc.name}
                titleHref={doc.href}
                whyRelevant={doc.whyRelevant}
              />
            ))}
          </ContextBlock>
        ) : null}

        {context.activities.length > 0 ? (
          <ContextBlock
            title="Relevant activities"
            viewAllHref={context.viewAllActivitiesHref}
            viewAllLabel="View all activities"
          >
            {context.activities.map((item) => (
              <ContextItem
                key={item.id}
                title={item.subject}
                titleHref={item.href}
                meta={item.dateLabel}
                whyRelevant={item.whyRelevant}
              />
            ))}
          </ContextBlock>
        ) : null}

        {context.opportunity ? (
          <div>
            <h3 className={EDITORIAL_FIELD_LABEL}>Related opportunity</h3>
            <div className="mt-4">
              <p className="text-[15px] font-medium text-carbon-blue">{context.opportunity.name}</p>
              <dl className="mt-3 space-y-2">
                <MetaRow label="Status" value={context.opportunity.status} />
                <MetaRow label="Attention" value={context.opportunity.attentionLevel} />
                <MetaRow label="Biggest unknown" value={context.opportunity.biggestUnknown} />
              </dl>
              <Link
                href={context.opportunity.href}
                className="mt-4 inline-block text-[12px] font-semibold text-upcycle-orange hover:underline"
              >
                Open opportunity
              </Link>
            </div>
          </div>
        ) : null}

        {context.contacts.length > 0 ? (
          <div>
            <h3 className={EDITORIAL_FIELD_LABEL}>Related contacts</h3>
            <ul className="mt-4 space-y-5">
              {context.contacts.map((contact) => (
                <li key={contact.contactId}>
                  <p className="text-[15px] font-medium text-carbon-blue">{contact.name}</p>
                  <dl className="mt-2 space-y-1">
                    <MetaRow label="Role" value={contact.role} />
                    <MetaRow label="Relationship" value={contact.relationship} />
                  </dl>
                  <Link
                    href={contact.href}
                    className="mt-2 inline-block text-[12px] font-semibold text-upcycle-orange hover:underline"
                  >
                    View contact
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {context.decisions.length > 0 ? (
          <div>
            <h3 className={EDITORIAL_FIELD_LABEL}>Related decisions</h3>
            <ul className="mt-4 space-y-5">
              {context.decisions.map((decision) => (
                <li key={decision.text}>
                  <p className={`${EDITORIAL_BODY} font-medium text-carbon-blue/85`}>{decision.text}</p>
                  <p className={`mt-1 ${EDITORIAL_META}`}>
                    <span className="text-carbon-blue/40">Why relevant: </span>
                    {decision.whyRelevant}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ContextBlock({
  title,
  children,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  children: ReactNode;
  viewAllHref: string | null;
  viewAllLabel: string;
}) {
  return (
    <div>
      <h3 className={EDITORIAL_FIELD_LABEL}>{title}</h3>
      <div className="mt-4 space-y-5">{children}</div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="mt-4 inline-block text-[12px] font-semibold text-upcycle-orange hover:underline"
        >
          {viewAllLabel}
        </Link>
      ) : null}
    </div>
  );
}

function ContextItem({
  title,
  titleHref,
  meta,
  whyRelevant,
}: {
  title: string;
  titleHref?: string | null;
  meta?: string;
  whyRelevant: string;
}) {
  return (
    <div>
      {titleHref ? (
        <Link href={titleHref} className="text-[15px] font-medium text-carbon-blue hover:text-upcycle-orange">
          {title}
        </Link>
      ) : (
        <p className="text-[15px] font-medium text-carbon-blue">{title}</p>
      )}
      {meta ? <p className={`mt-0.5 ${EDITORIAL_META}`}>{meta}</p> : null}
      <p className={`mt-1.5 ${EDITORIAL_META}`}>
        <span className="text-carbon-blue/40">Why relevant: </span>
        {whyRelevant}
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={EDITORIAL_META}>
      <span className="text-carbon-blue/40">{label}: </span>
      <span className="text-carbon-blue/70">{value}</span>
    </div>
  );
}
