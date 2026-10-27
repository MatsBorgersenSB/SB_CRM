"use client";

import { formatDate } from "@/lib/regional-format-preference";
import Link from "next/link";
import { ExternalLink, Mail, PenSquare } from "lucide-react";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceTopBar } from "@/components/ui/workspace-top-bar";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import type { EmailMessageIntelligenceDto } from "@/lib/email-intelligence-data";
import { outlookComposeUrl } from "@/lib/outlook-compose-link";

function formatSent(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date);
}

function relatedLink(message: EmailMessageIntelligenceDto) {
  if (message.opportunityId) {
    return {
      href: `/opportunities/${message.opportunityId}`,
      label: message.opportunityName || "Opportunity",
    };
  }
  if (message.contactId) {
    return {
      href: `/contacts/${message.contactId}`,
      label: message.contactName || "Contact",
    };
  }
  if (message.projectId) {
    return {
      href: `/projects/${message.projectId}`,
      label: message.projectName || "Project",
    };
  }
  return null;
}

export function MailShell({ messages }: { messages: EmailMessageIntelligenceDto[] }) {
  return (
    <WorkspaceChrome>
      <WorkspaceTopBar icon="document" title="Mail" />

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="dashboard-card flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
            <WorkspacePageTitle
              icon="document"
              title="Mail"
              subtitle="Recent mail SmartCRM has tied to a person, opportunity or project."
            />
            <a
              href={outlookComposeUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[13px] font-semibold text-white hover:bg-upcycle-orange/90"
            >
              <PenSquare className="size-4" aria-hidden />
              New mail
            </a>
          </section>

          <WorkspacePanel title="Recent mail" count={messages.length}>
            {messages.length === 0 ? (
              <p className="text-[13px] text-carbon-blue/60">
                No mail is linked to your relationships yet. Sync your mailbox or tag a
                mail in Outlook and it appears here.
              </p>
            ) : (
              <ul className="-mx-6 -my-5 divide-y divide-border/60">
                {messages.map((message) => {
                  const related = relatedLink(message);
                  return (
                    <li
                      key={message.id}
                      className="flex items-start gap-3 px-6 py-3 text-[13px]"
                    >
                      <Mail
                        className="mt-0.5 size-4 shrink-0 text-carbon-blue/45"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-carbon-blue">
                          {message.subject || "(no subject)"}
                        </p>
                        <p className="truncate text-[12px] text-carbon-blue/55">
                          {message.isOutbound ? "Sent to " : "From "}
                          {message.isOutbound
                            ? message.recipientEmails[0] || "—"
                            : message.senderEmail}
                          {" · "}
                          {formatSent(message.sentAt)}
                        </p>
                        {message.bodyPreview ? (
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-carbon-blue/45">
                            {message.bodyPreview}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-[12px]">
                        {related ? (
                          <Link
                            href={related.href}
                            className="max-w-[12rem] truncate font-semibold text-upcycle-orange hover:underline"
                          >
                            {related.label}
                          </Link>
                        ) : null}
                        {message.webLink ? (
                          <a
                            href={message.webLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-carbon-blue/55 hover:text-carbon-blue"
                          >
                            Open in Outlook
                            <ExternalLink className="size-3" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </WorkspacePanel>
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
