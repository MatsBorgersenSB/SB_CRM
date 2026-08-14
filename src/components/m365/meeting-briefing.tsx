"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { M365MeetingBriefingPayload, M365RiskBlock } from "@/types/m365";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { ImpactContext } from "@/components/m365/impact-context";
import { openOutlookDraft } from "@/components/opportunities/draft-in-outlook-button";
import {
  MEETING_REPLY_LANGUAGES,
  buildMeetingBriefingReplyDraft,
  type MeetingReplyLanguageCode,
} from "@/lib/m365/meeting-briefing-reply";

function BlockLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
      {children}
    </h3>
  );
}

const PRIMARY_BTN =
  "inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50";

const SECONDARY_BTN =
  "inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange/45 hover:text-upcycle-orange";

const TEXT_LINK =
  "text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange";

function RiskRow({ risk }: { risk: M365RiskBlock }) {
  const severityStyles =
    risk.severity === "critical"
      ? "border-red-200/60 bg-red-50/50"
      : risk.severity === "warning"
        ? "border-upcycle-orange/25 bg-upcycle-orange/[0.03]"
        : "border-carbon-blue/10 bg-carbon-blue/[0.02]";

  return (
    <li className={`border px-3 py-2 ${severityStyles}`}>
      <p className="text-[12px] font-medium text-carbon-blue">{risk.label}</p>
      {risk.detail ? (
        <p className="mt-0.5 text-[11px] leading-relaxed text-carbon-blue/55">{risk.detail}</p>
      ) : null}
      <ImpactContext items={risk.impact} />
    </li>
  );
}

function SmartCrmLink({
  href,
  label,
  outlookHost,
  className,
}: {
  href: string;
  label: string;
  outlookHost: boolean;
  className?: string;
}) {
  const cls = className ?? TEXT_LINK;
  if (outlookHost) {
    return (
      <a href={buildSmartCrmUrl(href)} target="_blank" rel="noopener noreferrer" className={cls}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}

/**
 * Meeting Briefing — seven sections, Michelin layout.
 * Above fold: who → objective → NBA. Soft scroll for supporting context only.
 */
export function MeetingBriefing({
  payload,
  variant = "default",
}: {
  payload: M365MeetingBriefingPayload;
  variant?: "default" | "outlook";
}) {
  const outlookHost = variant === "outlook";
  const shellClass = outlookHost
    ? "flex h-full max-h-[100dvh] flex-col overflow-hidden bg-white"
    : "dashboard-card overflow-hidden";

  const [moreRisksOpen, setMoreRisksOpen] = useState(false);
  const [replyLanguage, setReplyLanguage] = useState<MeetingReplyLanguageCode>("en");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);

  const primaryRisk = payload.topRisks[0] ?? null;
  const moreRisks = payload.topRisks.slice(1);
  const primaryOpp = payload.openOpportunities[0] ?? null;

  const replyDraft = useMemo(
    () => buildMeetingBriefingReplyDraft(payload, replyLanguage),
    [payload, replyLanguage],
  );

  const whoLine = payload.counterpartyName
    ? `${payload.counterpartyName}${payload.counterpartyRole ? ` · ${payload.counterpartyRole}` : ""}`
    : null;

  const prepareReply = async () => {
    if (!payload.counterpartyEmail?.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      await openOutlookDraft({
        toEmail: payload.counterpartyEmail.trim(),
        subject: replyDraft.subject,
        bodyHtml: replyDraft.bodyHtml,
      });
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Could not open Outlook draft");
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <article className={shellClass}>
      <div
        className={`space-y-3 ${outlookHost ? "min-h-0 flex-1 overflow-y-auto px-4 py-3" : "px-5 py-5"}`}
      >
        <header>
          {outlookHost ? (
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
              SmartCRM · Meeting Briefing
            </p>
          ) : null}
          <p className={`text-[15px] font-semibold text-carbon-blue ${outlookHost ? "mt-1" : ""}`}>
            {payload.companyName}
          </p>
          {whoLine ? (
            <p className="mt-0.5 text-[12px] text-carbon-blue/65">{whoLine}</p>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-carbon-blue/55">
            {payload.relationshipSummary}
          </p>
        </header>

        <section
          aria-label="Primary Objective"
          className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-3 py-3"
        >
          <BlockLabel>Meeting objective</BlockLabel>
          <p className="mt-2 text-[13px] font-semibold leading-snug text-carbon-blue">
            {payload.meetingObjective}
          </p>
        </section>

        <section
          aria-label="Next Best Action"
          className="border border-upcycle-orange/35 bg-upcycle-orange/[0.05] px-3 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BlockLabel>Next best action</BlockLabel>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange/80">
              {payload.nextBestAction.priority} priority
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-carbon-blue">
            {payload.nextBestAction.action}
          </p>
          <ImpactContext items={payload.nextBestAction.impact} />

          {payload.counterpartyEmail ? (
            <div className="mt-3 space-y-2 border-t border-upcycle-orange/20 pt-3">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/45">
                  Reply language
                </span>
                <select
                  value={replyLanguage}
                  onChange={(event) =>
                    setReplyLanguage(event.target.value as MeetingReplyLanguageCode)
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue outline-none focus:border-upcycle-orange"
                >
                  {MEETING_REPLY_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={replyBusy}
                onClick={() => void prepareReply()}
                className={`w-full ${PRIMARY_BTN}`}
              >
                {replyBusy ? "Opening draft…" : "Prepare reply"}
              </button>
              <button
                type="button"
                onClick={() => setShowDraftPreview((open) => !open)}
                className="w-full text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50 hover:text-upcycle-orange"
              >
                {showDraftPreview ? "Hide draft preview" : "Preview draft"}
              </button>
              {showDraftPreview ? (
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap border border-carbon-blue/10 bg-white px-2.5 py-2 font-sans text-[11px] leading-relaxed text-carbon-blue/75">
                  {replyDraft.bodyPlain}
                </pre>
              ) : null}
              {replyError ? (
                <p className="text-[10px] text-thermal-red">{replyError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-2">
            {primaryOpp ? (
              <SmartCrmLink
                href={primaryOpp.href}
                label={`Open ${primaryOpp.label}`}
                outlookHost={outlookHost}
                className={SECONDARY_BTN}
              />
            ) : (
              <SmartCrmLink
                href={payload.nextBestAction.href || payload.deepLink}
                label="Open in SmartCRM"
                outlookHost={outlookHost}
                className={PRIMARY_BTN}
              />
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-0.5">
              <SmartCrmLink
                href={payload.deepLink}
                label="Open account"
                outlookHost={outlookHost}
              />
              {payload.nextBestAction.plannerEligible ? (
                <a
                  href="https://tasks.office.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={TEXT_LINK}
                >
                  Execute in Planner
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section aria-label="What Changed">
          <BlockLabel>What changed</BlockLabel>
          {payload.whatChanged.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {payload.whatChanged.map((line) => (
                <li key={line} className="text-[12px] leading-relaxed text-carbon-blue/65">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-carbon-blue/45">No material changes since last touch.</p>
          )}
        </section>

        <section aria-label="Open Opportunities">
          <BlockLabel>Open opportunities</BlockLabel>
          {payload.openOpportunities.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {payload.openOpportunities.map((opp) => (
                <li key={opp.id} className="border border-carbon-blue/10 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <SmartCrmLink
                      href={opp.href}
                      label={opp.label}
                      outlookHost={outlookHost}
                      className="text-[13px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                    />
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-carbon-blue/55">
                      {opp.valueLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-carbon-blue/45">{opp.stage}</p>
                  {opp.impact[0] ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-carbon-blue/60">
                      {opp.impact[0]}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-carbon-blue/45">No open opportunities.</p>
          )}
        </section>

        <section aria-label="Top Risks">
          <BlockLabel>Top risk</BlockLabel>
          {primaryRisk ? (
            <ul className="mt-2 space-y-2">
              <RiskRow risk={primaryRisk} />
              {moreRisks.length > 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setMoreRisksOpen((open) => !open)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50 hover:text-upcycle-orange"
                  >
                    {moreRisksOpen
                      ? "Hide other risks"
                      : `${moreRisks.length} more risk${moreRisks.length === 1 ? "" : "s"}`}
                  </button>
                  {moreRisksOpen ? (
                    <ul className="mt-2 space-y-2">
                      {moreRisks.map((risk) => (
                        <RiskRow key={risk.id} risk={risk} />
                      ))}
                    </ul>
                  ) : null}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-carbon-blue/45">No urgent risks flagged.</p>
          )}
        </section>

        <section aria-label="Discussion Topics">
          <BlockLabel>Discussion topics</BlockLabel>
          {payload.discussionTopics.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-carbon-blue/70">
              {payload.discussionTopics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[12px] text-carbon-blue/45">No discussion topics suggested.</p>
          )}
        </section>
      </div>
    </article>
  );
}
