"use client";

import { useEffect, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { company360Href } from "@/types/company-360";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import {
  resolveOutlookSelectedMessageSeeds,
  subscribeOutlookMailboxItemChanged,
  type OutlookOpenMessageSeed,
} from "@/lib/m365/outlook-context";
import { OutlookGraphConsentStrip } from "@/components/m365/outlook-connect-action";
import {
  showOutlookImportCompletedBanner,
  showSmartCrmCategoryOnOpenMail,
} from "@/lib/m365/outlook-smartcrm-category";
import { mailTopic, matchingOpportunityForTopic } from "@/lib/mail-opportunity-draft";
import type { UserRole } from "@/types/auth";

type LinkOption = {
  id: string;
  label: string;
  name: string;
  companyId?: string | null;
};

type TagContextPayload = {
  contactId: string;
  companyId?: string;
  selectedCompanyId?: string | null;
  companyName: string;
  companyOptions?: LinkOption[];
  currentOpportunityId: string | null;
  currentProjectId: string | null;
  opportunityOptions: LinkOption[];
  projectOptions: LinkOption[];
  relationshipPosture?: CompanyRelationshipPosture;
  opportunityEligible?: boolean;
  contactName?: string;
  savedMails?: SavedOutlookMail[];
  needsMicrosoftConsent?: boolean;
  error?: string;
};

type SavedMeeting = { activityId: string; subject: string; startDate: string };

type SavedOutlookMail = {
  externalMessageId: string;
  subject: string;
  isOutbound: boolean;
  sentAt: string;
  senderEmail: string;
};

/** What SmartCRM already holds for the open mail — shown persistently, not as a toast. */
type CrmSavedState = {
  mailSaved: boolean;
  isMeeting: boolean;
  meeting: SavedMeeting | null;
};

function formatMeetingWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Compact Outlook add-in control: tag the open thread and/or open a tagged draft.
 * Opportunity is sell-to only. Project is allowed for any posture (supplier / partner / customer).
 */
export function OutlookMailTagPanel({
  email,
  role = "superuser",
  opportunityEligible,
}: {
  email: string;
  role?: UserRole;
  /** When false, hide Opportunity tagging only — Project remains available. */
  opportunityEligible?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [seed, setSeed] = useState<OutlookOpenMessageSeed | null>(null);
  const [seeds, setSeeds] = useState<OutlookOpenMessageSeed[]>([]);
  const [context, setContext] = useState<TagContextPayload | null>(null);
  const [linkKind, setLinkKind] = useState<"opportunity" | "project">("opportunity");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [crmState, setCrmState] = useState<CrmSavedState | null>(null);
  const [savedMails, setSavedMails] = useState<SavedOutlookMail[]>([]);
  const [savedMailTick, setSavedMailTick] = useState(0);
  const [needsMicrosoftConsent, setNeedsMicrosoftConsent] = useState(false);
  const [smartSuggestedLabel, setSmartSuggestedLabel] = useState<string | null>(null);
  const [importCompletedBanner, setImportCompletedBanner] = useState<{
    headline: string;
    detail: string;
    savedCount: number;
  } | null>(null);

  const seedMessageId = seed?.externalMessageId ?? "";
  const seedConversationId = seed?.conversationId ?? "";
  const seedSubject = seed?.subject ?? "";
  const [prevSeedMessageId, setPrevSeedMessageId] = useState(seedMessageId);
  if (seedMessageId !== prevSeedMessageId) {
    setPrevSeedMessageId(seedMessageId);
    setCrmState(null);
    setImportCompletedBanner(null);
  }
  useEffect(() => {
    if (!seedMessageId) return;
    let cancelled = false;
    const params = new URLSearchParams({ externalMessageId: seedMessageId });
    if (seedSubject) params.set("subject", seedSubject);
    if (seedConversationId) params.set("conversationId", seedConversationId);
    void fetch(`/api/m365/outlook/save-meeting?${params}`, {
      headers: { [AUTH_ROLE_HEADER]: role },
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as CrmSavedState;
        if (!cancelled) {
          setCrmState({
            mailSaved: Boolean(payload.mailSaved),
            isMeeting: Boolean(payload.isMeeting),
            meeting: payload.meeting ?? null,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [seedMessageId, seedConversationId, seedSubject, role]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void subscribeOutlookMailboxItemChanged(() => {
      void resolveOutlookSelectedMessageSeeds().then((openSeeds) => {
        if (cancelled) return;
        setSeeds(openSeeds);
        setSeed(openSeeds[0] ?? null);
        setStatus(null);
        setError(null);
      });
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const openSeeds = await resolveOutlookSelectedMessageSeeds();
        if (cancelled) return;
        setSeeds(openSeeds);
        setSeed(openSeeds[0] ?? null);

        const params = new URLSearchParams({ email });
        if (openSeeds[0]?.conversationId) {
          params.set("conversationId", openSeeds[0].conversationId);
        }
        const response = await fetch(`/api/m365/outlook/mail-tag?${params}`, {
          headers: { [AUTH_ROLE_HEADER]: role },
          credentials: "include",
        });
        const payload = (await response.json().catch(() => ({}))) as TagContextPayload & {
          detail?: string;
        };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || "Unable to load tag options");
        }
        if (cancelled) return;
        setContext(payload);
        setSavedMails(payload.savedMails ?? []);
        setNeedsMicrosoftConsent(payload.needsMicrosoftConsent === true);
        setSmartSuggestedLabel(null);
        const preferOpportunity =
          payload.opportunityEligible ?? opportunityEligible ?? true;
        const topic = openSeeds[0]?.subject ? mailTopic(openSeeds[0].subject) : "";
        const companyDeals = (payload.opportunityOptions ?? [])
          .filter(
            (row) =>
              !payload.selectedCompanyId ||
              !row.companyId ||
              row.companyId === payload.selectedCompanyId,
          )
          .map((row) => ({ id: row.id, assetName: row.name, label: row.label }));
        const companyProjects = (payload.projectOptions ?? []).map((row) => ({
          id: row.id,
          assetName: row.name,
          label: row.label,
        }));
        const matchedDeal =
          preferOpportunity && topic
            ? matchingOpportunityForTopic(companyDeals, topic)
            : null;
        const matchedProject = topic
          ? matchingOpportunityForTopic(companyProjects, topic)
          : null;

        if (payload.currentOpportunityId) {
          setLinkKind("opportunity");
          setSelectedId(payload.currentOpportunityId);
        } else if (payload.currentProjectId) {
          setLinkKind("project");
          setSelectedId(payload.currentProjectId);
        } else if (matchedDeal) {
          setLinkKind("opportunity");
          setSelectedId(matchedDeal.id);
          setSmartSuggestedLabel(matchedDeal.label);
        } else if (matchedProject) {
          setLinkKind("project");
          setSelectedId(matchedProject.id);
          setSmartSuggestedLabel(matchedProject.label);
        } else if (
          preferOpportunity &&
          (payload.opportunityOptions?.length ?? 0) > 0
        ) {
          setLinkKind("opportunity");
          setSelectedId("");
        } else {
          setLinkKind("project");
          setSelectedId("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load tags");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, role, opportunityEligible]);

  useEffect(() => {
    if (!email || !seedConversationId || savedMailTick === 0) {
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ email, conversationId: seedConversationId });
    void fetch(`/api/m365/outlook/mail-tag?${params}`, {
      headers: { [AUTH_ROLE_HEADER]: role },
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as TagContextPayload;
        if (!cancelled) {
          setSavedMails(payload.savedMails ?? []);
          setNeedsMicrosoftConsent(payload.needsMicrosoftConsent === true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [email, role, seedConversationId, savedMailTick]);

  const openMailSaved =
    crmState?.mailSaved === true ||
    savedMails.some((mail) => mail.externalMessageId === seedMessageId);

  useEffect(() => {
    if (!openMailSaved) return;
    void showSmartCrmCategoryOnOpenMail();
  }, [openMailSaved, seedMessageId]);

  // Relating mail to an existing Opportunity or Project is always allowed.
  const opportunityTagging = true;

  const options =
    linkKind === "project"
      ? context?.projectOptions ?? []
      : opportunityTagging
        ? context?.opportunityOptions ?? []
        : [];
  const selectedCount = seeds.length;
  const selectedTagLabel = options.find((row) => row.id === selectedId)?.label ?? "";
  const seedAttachments = seeds.flatMap((row) => row.attachments ?? []);
  const destinationSummary =
    seedAttachments.length === 0
      ? selectedTagLabel
        ? `Saving links to ${selectedTagLabel}. Deep attachment filing is in SmartCRM web.`
        : "Save links the mail. Deep attachment filing is in SmartCRM web."
      : selectedTagLabel
        ? `${seedAttachments.length} attachment(s) auto-file with save · link ${selectedTagLabel}. Review/classify in SmartCRM if needed.`
        : `${seedAttachments.length} attachment(s) auto-file with save. Review/classify in SmartCRM if needed.`;

  /** Save the calendar meeting behind this invite/response as an Activity. Throws on failure. */
  const saveMeetingActivity = async (row: OutlookOpenMessageSeed) => {
    const response = await fetch("/api/m365/outlook/save-meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json", [AUTH_ROLE_HEADER]: role },
      credentials: "include",
      body: JSON.stringify({
        email,
        contactId: context?.contactId,
        seed: {
          externalMessageId: row.externalMessageId,
          conversationId: row.conversationId,
          subject: row.subject,
        },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      created?: boolean;
      companyName?: string;
      meeting?: SavedMeeting;
    };
    if (!response.ok || !payload.meeting) {
      throw new Error(
        `Mail saved, but the meeting was not: ${payload.detail || payload.error || "unknown error"}`,
      );
    }
    const meeting = payload.meeting;
    setCrmState((prev) => ({
      mailSaved: prev?.mailSaved ?? true,
      isMeeting: true,
      meeting,
    }));
    setStatus(
      payload.created === false
        ? `Meeting was already in SmartCRM as ${meeting.activityId}.`
        : `Meeting saved in SmartCRM as ${meeting.activityId} on ${payload.companyName ?? "the company"}.`,
    );
  };

  const saveSelectedMails = async (link?: {
    opportunityId?: string | null;
    projectId?: string | null;
  }) => {
    if (!context?.contactId || seeds.length === 0) return;
    const matchedSeeds = seeds.filter((row) => Boolean(row.externalMessageId?.trim()));
    if (matchedSeeds.length === 0) {
      setError("Select one or more mails in Outlook, then save.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/m365/outlook/mail-tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          contactId: context.contactId,
          ...(link?.opportunityId !== undefined ? { opportunityId: link.opportunityId } : {}),
          ...(link?.projectId !== undefined ? { projectId: link.projectId } : {}),
          messages: matchedSeeds.map((row) => ({
            conversationId: row.conversationId,
            message: {
              externalMessageId: row.externalMessageId,
              alternateItemId: row.alternateItemId,
              internetMessageId: row.internetMessageId,
              subject: row.subject,
              senderEmail: row.senderEmail || email,
              recipientEmails: row.recipientEmails,
              ...(row.sentAt ? { sentAt: row.sentAt } : {}),
              bodyPreview: row.bodyPreview,
              webLink: row.webLink,
              isOutbound: row.isOutbound === true,
            },
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        saved?: number;
        failed?: number;
        total?: number;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not save mail in SmartCRM");
      }
      const saved = payload.saved ?? 0;
      const failed = payload.failed ?? 0;
      const skipped = seeds.length - matchedSeeds.length;
      if (saved === 0) {
        throw new Error("Could not save these mails for the matched contact.");
      }
      setCrmState((prev) => ({
        mailSaved: true,
        isMeeting: prev?.isMeeting ?? false,
        meeting: prev?.meeting ?? null,
      }));
      if (link) {
        setContext((prev) =>
          prev
            ? {
                ...prev,
                ...(link.opportunityId !== undefined
                  ? { currentOpportunityId: link.opportunityId }
                  : {}),
                ...(link.projectId !== undefined
                  ? { currentProjectId: link.projectId }
                  : {}),
              }
            : prev,
        );
      }
      const linkedLabel = link?.opportunityId
        ? context.opportunityOptions.find((row) => row.id === link.opportunityId)?.name ??
          "the opportunity"
        : link?.projectId
          ? context.projectOptions.find((row) => row.id === link.projectId)?.name ??
            "the project"
          : null;
      const summaryDetail =
        failed + skipped > 0
          ? `Imported ${saved} of ${seeds.length} mails from Outlook to SmartCRM on ${context.companyName}${linkedLabel ? ` (${linkedLabel})` : ""}.`
          : saved === 1
            ? `1 mail imported from Outlook to SmartCRM on ${context.companyName}${linkedLabel ? ` and linked to ${linkedLabel}` : ""}.`
            : `${saved} mails imported from Outlook to SmartCRM on ${context.companyName}${linkedLabel ? ` and linked to ${linkedLabel}` : ""}.`;
      setStatus(summaryDetail);
      setImportCompletedBanner({
        headline:
          saved === 1
            ? "Import completed (Outlook → SmartCRM)"
            : `Import completed — ${saved} mails saved (Outlook → SmartCRM)`,
        detail: summaryDetail,
        savedCount: saved,
      });
      setSavedMailTick((tick) => tick + 1);
      void showSmartCrmCategoryOnOpenMail();
      void showOutlookImportCompletedBanner(
        saved === 1
          ? `Import completed (Outlook → SmartCRM) · ${context.companyName}`
          : `Import completed: ${saved} mails saved to SmartCRM`,
      );
      if (crmState?.isMeeting && seeds.length === 1 && seeds[0]) {
        await saveMeetingActivity(seeds[0]);
      }
      // One click = mail + attachments (announced in destinationSummary before save).
      // Failures here never undo the saved mail. Skip when Outlook told us there is nothing attached.
      const matchedHaveAttachments =
        !matchedSeeds.every((row) => Array.isArray(row.attachments)) ||
        matchedSeeds.some((row) => (row.attachments?.length ?? 0) > 0);
      if (matchedHaveAttachments) {
        void syncAttachmentsToSmartDocs({ seeds: matchedSeeds, link });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save mail");
    } finally {
      setBusy(false);
    }
  };

  const currentSelectionLink = selectedId
    ? linkKind === "project"
      ? { projectId: selectedId }
      : { opportunityId: selectedId }
    : undefined;

  const markRelationshipInOutlook = async () => {
    await saveSelectedMails(currentSelectionLink);
  };

  /**
   * Auto-files attachments after Save — destination follows the save link.
   * Multi-step classify/filing UI lives on web SmartCRM (Michelin hard-cap).
   */
  const syncAttachmentsToSmartDocs = async (auto: {
    seeds: OutlookOpenMessageSeed[];
    link?: { opportunityId?: string | null; projectId?: string | null };
  }) => {
    const sourceSeeds = auto.seeds;
    if (sourceSeeds.length === 0) return;
    setSyncBusy(true);
    setSyncError(null);
    setSyncStatus(null);
    try {
      const emailExternalMessageIds = sourceSeeds
        .map((row) => row.externalMessageId?.trim())
        .filter(Boolean) as string[];
      if (emailExternalMessageIds.length === 0) {
        throw new Error("No message ids to sync attachments.");
      }

      const response = await fetch("/api/m365/sync-attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        credentials: "include",
        body: JSON.stringify({
          emailExternalMessageIds,
          ...(auto.link?.opportunityId ? { opportunityId: auto.link.opportunityId } : {}),
          ...(auto.link?.projectId ? { projectId: auto.link.projectId } : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        documentsSaved?: number;
        fetchedAttachments?: number;
        skippedEmailCount?: number;
        skippedAttachments?: Array<{ name: string; reason: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not sync attachments");
      }

      const saved = payload.documentsSaved ?? 0;
      const fetched = payload.fetchedAttachments ?? 0;
      const skippedFiles = payload.skippedAttachments ?? [];
      const notFiled = skippedFiles.filter((row) => row.reason !== "inline_image");
      const skippedNote = [
        notFiled.length > 0
          ? ` ${notFiled.length} not filed: ${notFiled
              .slice(0, 3)
              .map((row) => row.name)
              .join(", ")}${notFiled.length > 3 ? "…" : ""}.`
          : "",
        (payload.skippedEmailCount ?? 0) > 0
          ? ` ${payload.skippedEmailCount} mail(s) not filed — no company or opportunity to file under.`
          : "",
      ].join("");
      setSyncStatus(
        saved > 0
          ? `Filed ${saved} attachment(s) into SmartDocs (${fetched} fetched).${skippedNote}`
          : `No attachments were filed into SmartDocs (${fetched} fetched).${skippedNote}`,
      );
    } catch (syncErr) {
      setSyncError(
        syncErr instanceof Error ? syncErr.message : "Could not file attachments",
      );
    } finally {
      setSyncBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <p className="text-[12px] text-carbon-blue/65">Loading mail tag options…</p>
      </div>
    );
  }

  if (!context) {
    return error ? (
      <div className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <p className="text-[12px] text-thermal-red">{error}</p>
      </div>
    ) : null;
  }

  return (
    <div className="border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Save / link
      </p>
      <p className="mt-1 text-[12px] leading-snug text-carbon-blue/55">
        {selectedCount > 1
          ? `${selectedCount} mails selected. Save them onto this contact, or tag all to a project${
              opportunityTagging ? " or opportunity" : ""
            }.`
          : opportunityTagging
            ? "Save this mail onto the contact, or tag the thread to an opportunity or project."
            : `${context.companyName} is not sell-to — link this mail to a project (e.g. Escalante), or save it on the company. Opportunity stays hidden.`}
      </p>
      <SelectedMailSubjects seeds={seeds} />

      {needsMicrosoftConsent ? <OutlookGraphConsentStrip /> : null}

      {importCompletedBanner && !error ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-2 border-2 border-emerald-600 bg-emerald-600 px-3 py-2.5 text-white"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]">
            ✓ {importCompletedBanner.headline}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/95">
            {importCompletedBanner.detail}
          </p>
          {syncBusy ? (
            <p className="mt-1 text-[11px] font-medium text-white/85">
              Filing attachments into SmartDocs…
            </p>
          ) : syncStatus ? (
            <p className="mt-1 text-[11px] font-medium text-white/90">
              {syncStatus}
            </p>
          ) : null}
        </div>
      ) : null}

      {seed ? (
        <div
          className={`mt-2 border px-2.5 py-2 text-[12px] leading-snug ${
            error
              ? "border-thermal-red/40 bg-thermal-red/5"
              : crmState?.mailSaved || crmState?.meeting || savedMails.length > 0
                ? "border-emerald-600/40 bg-emerald-50"
                : "border-carbon-blue/15 bg-white"
          }`}
          role="status"
        >
          {error ? (
            <p className="font-semibold text-thermal-red">Not saved: {error}</p>
          ) : null}
          {!error && status && !importCompletedBanner ? (
            <p className="font-semibold text-emerald-700">✓ {status}</p>
          ) : null}
          {crmState?.mailSaved || crmState?.meeting || savedMails.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-carbon-blue/80">
              {savedMails.length > 0 ? (
                <li className="font-semibold text-emerald-800">
                  {savedMails.length === 1
                    ? `1 mail is in SmartCRM on ${context.companyName}`
                    : `${savedMails.length} mails are in SmartCRM on ${context.companyName}`}
                </li>
              ) : crmState?.mailSaved ? (
                <li>✓ Mail is saved in SmartCRM</li>
              ) : null}
              {savedMails.map((mail) => (
                <li key={mail.externalMessageId}>
                  {mail.isOutbound
                    ? "Sent"
                    : context.contactName
                      ? `From ${context.contactName}`
                      : "Received"}
                  {formatMeetingWhen(mail.sentAt) ? ` · ${formatMeetingWhen(mail.sentAt)}` : ""}
                  {mail.externalMessageId === seedMessageId ? " · this mail" : ""}
                </li>
              ))}
              {selectedCount > 1 || openMailSaved ? null : (
                <li className="text-upcycle-orange">This mail is not in SmartCRM yet</li>
              )}
              {crmState?.meeting ? (
                <li>
                  ✓ Meeting is saved in SmartCRM as{" "}
                  <a
                    href={buildSmartCrmUrl(`/activities/${crmState.meeting.activityId}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-upcycle-orange hover:underline"
                  >
                    {crmState.meeting.activityId}
                  </a>
                  {crmState.meeting.startDate
                    ? ` · ${formatMeetingWhen(crmState.meeting.startDate)}`
                    : ""}
                </li>
              ) : crmState?.isMeeting ? (
                <li className="text-upcycle-orange">Meeting is not in SmartCRM yet</li>
              ) : null}
            </ul>
          ) : !error && !status && crmState ? (
            <p className="text-carbon-blue/65">
              {crmState.isMeeting
                ? "Not saved in SmartCRM yet — this mail is a meeting."
                : "Not saved in SmartCRM yet."}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex gap-1">
        {(
          [
            { kind: "project" as const, label: "Project", enabled: true },
            {
              kind: "opportunity" as const,
              label: "Opportunity",
              enabled: opportunityTagging,
            },
          ] as const
        ).map((entry) => (
          <button
            key={entry.kind}
            type="button"
            disabled={!entry.enabled}
            onClick={() => {
              if (!entry.enabled) return;
              setLinkKind(entry.kind);
              setSelectedId(
                entry.kind === "opportunity"
                  ? context.currentOpportunityId ?? ""
                  : context.currentProjectId ?? "",
              );
              setSmartSuggestedLabel(null);
              setStatus(null);
            }}
            className={`flex-1 border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 ${
              linkKind === entry.kind
                ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                : "border-carbon-blue/15 bg-white text-carbon-blue/50"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
        {linkKind === "opportunity" ? "Opportunity (optional)" : "Project (optional)"}
        <select
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setSmartSuggestedLabel(null);
          }}
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[13px] font-medium text-carbon-blue"
        >
          <option value="">Company only ({context.companyName})</option>
          {(() => {
            const sameCompany = context.selectedCompanyId
              ? options.filter((opt) => opt.companyId === context.selectedCompanyId)
              : [];
            const otherOptions = options.filter((opt) => !sameCompany.includes(opt));
            if (sameCompany.length === 0) {
              return options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ));
            }
            return (
              <>
                <optgroup label={`On ${context.companyName}`}>
                  {sameCompany.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                {otherOptions.length > 0 ? (
                  <optgroup label="Other open work">
                    {otherOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </>
            );
          })()}
        </select>
      </label>

      {smartSuggestedLabel && selectedId ? (
        <p className="mt-1 text-[11px] text-emerald-700">
          SmartAssist pre-selected <span className="font-semibold">{smartSuggestedLabel}</span>{" "}
          from this email subject.
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-1.5">
        {seed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markRelationshipInOutlook()}
            className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
          >
            {busy
              ? "Importing Outlook → SmartCRM…"
              : selectedCount > 1
                ? selectedTagLabel
                  ? `Save ${selectedCount} mails & link to ${selectedTagLabel}`
                  : `Save ${selectedCount} mails in SmartCRM`
                : crmState?.isMeeting
                  ? crmState.meeting
                    ? selectedTagLabel
                      ? `Update link to ${selectedTagLabel}`
                      : "✓ Import completed — save again"
                    : "Save meeting in SmartCRM"
                  : importCompletedBanner
                    ? selectedTagLabel
                      ? `✓ Import completed · Update link to ${selectedTagLabel}`
                      : "✓ Import completed (Outlook → SmartCRM)"
                    : openMailSaved
                      ? selectedTagLabel
                        ? `Update link to ${selectedTagLabel}`
                        : "Saved — save again"
                      : selectedTagLabel
                        ? `Save & link to ${selectedTagLabel}`
                        : `Save to ${context.companyName}`}
          </button>
        ) : (
          <p className="text-[11px] text-carbon-blue/65">
            Select one or more mails in Outlook, then save them here.
          </p>
        )}

        {/* Michelin hard-cap: multi-step SmartDoc filing lives on web, not in the pane. */}
        {(context.companyId || context.selectedCompanyId) && seed ? (
          <a
            href={buildSmartCrmUrl(
              company360Href(context.companyId ?? context.selectedCompanyId ?? "", "outlook"),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center border border-carbon-blue/15 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
          >
            File attachments in SmartCRM
          </a>
        ) : null}
      </div>

      {syncStatus ? <p className="mt-1.5 text-[11px] text-emerald-700">{syncStatus}</p> : null}
      {syncError ? <p className="mt-1.5 text-[11px] text-thermal-red">{syncError}</p> : null}
      {destinationSummary ? (
        <p className="mt-1.5 text-[11px] leading-snug text-carbon-blue/55">{destinationSummary}</p>
      ) : null}
    </div>
  );
}

function SelectedMailSubjects({ seeds }: { seeds: OutlookOpenMessageSeed[] }) {
  if (seeds.length <= 1) return null;
  return (
    <ul className="mt-2 max-h-28 overflow-auto text-[12px] leading-snug text-carbon-blue/60">
      {seeds.slice(0, 8).map((row) => (
        <li key={row.externalMessageId} className="truncate">
          {typeof row.subject === "string" ? row.subject : "(no subject)"}
        </li>
      ))}
    </ul>
  );
}
