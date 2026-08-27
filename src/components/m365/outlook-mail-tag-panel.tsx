"use client";

import { useEffect, useState } from "react";
import { DraftInOutlookButton } from "@/components/opportunities/draft-in-outlook-button";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import {
  resolveOutlookSelectedMessageSeeds,
  subscribeOutlookMailboxItemChanged,
  type OutlookOpenMessageSeed,
} from "@/lib/m365/outlook-context";
import {
  SMARTDOC_CATEGORIES,
  SMARTDOC_TYPES_BY_CATEGORY,
  type SmartDocCategory,
} from "@/types/smartdoc-library";
import type { UserRole } from "@/types/auth";

type LinkOption = {
  id: string;
  label: string;
  name: string;
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
  error?: string;
};

type FiledDocumentReview = {
  id: string;
  name: string;
  docCategory: SmartDocCategory;
  docType: string;
};

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
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDocs, setReviewDocs] = useState<FiledDocumentReview[]>([]);
  const [attachmentTarget, setAttachmentTarget] = useState<"company" | "opportunity" | "project">(
    "company",
  );
  const [attachmentCompanyId, setAttachmentCompanyId] = useState("");
  const [attachmentRelationKind, setAttachmentRelationKind] = useState<
    "none" | "opportunity" | "project"
  >("none");
  const [attachmentRelationId, setAttachmentRelationId] = useState("");

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void subscribeOutlookMailboxItemChanged(() => {
      void resolveOutlookSelectedMessageSeeds().then((openSeeds) => {
        if (cancelled) return;
        setSeeds(openSeeds);
        setSeed(openSeeds[0] ?? null);
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
        const canUseOpportunity =
          payload.opportunityEligible ?? opportunityEligible ?? true;
        if (payload.currentProjectId) {
          setLinkKind("project");
          setSelectedId(payload.currentProjectId);
        } else if (payload.currentOpportunityId && canUseOpportunity) {
          setLinkKind("opportunity");
          setSelectedId(payload.currentOpportunityId);
        } else {
          setLinkKind("project");
          setSelectedId("");
        }
        setAttachmentCompanyId(payload.selectedCompanyId ?? "");
        setAttachmentRelationKind("none");
        setAttachmentRelationId("");
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
  }, [email, role]);

  useEffect(() => {
    // Keep filing destination valid when no opportunity/project is selected.
    if ((attachmentTarget === "opportunity" || attachmentTarget === "project") && !selectedId) {
      setAttachmentTarget("company");
    }
  }, [attachmentTarget, selectedId]);

  const opportunityTagging =
    opportunityEligible ?? context?.opportunityEligible ?? true;

  useEffect(() => {
    if (!opportunityTagging && attachmentTarget === "opportunity") {
      setAttachmentTarget("company");
    }
    if (!opportunityTagging && attachmentRelationKind === "opportunity") {
      setAttachmentRelationKind("none");
      setAttachmentRelationId("");
    }
    if (!opportunityTagging && linkKind === "opportunity") {
      setLinkKind("project");
      setSelectedId("");
    }
  }, [opportunityTagging, attachmentTarget, attachmentRelationKind, linkKind]);

  const options =
    linkKind === "project"
      ? context?.projectOptions ?? []
      : opportunityTagging
        ? context?.opportunityOptions ?? []
        : [];
  const selectedCount = seeds.length;
  const companyOptions = context?.companyOptions ?? [];
  const selectedCompanyLabel =
    companyOptions.find((row) => row.id === attachmentCompanyId)?.label ??
    context?.companyName ??
    "selected company";
  const selectedTagLabel = options.find((row) => row.id === selectedId)?.label ?? "";
  const relationOptions =
    attachmentRelationKind === "project"
      ? context?.projectOptions ?? []
      : context?.opportunityOptions ?? [];
  const relationLabel = relationOptions.find((row) => row.id === attachmentRelationId)?.label ?? "";
  const canFileAttachments =
    seed != null &&
    !busy &&
    !syncBusy &&
    !(
      (attachmentTarget === "company" && !attachmentCompanyId) ||
      ((attachmentTarget === "opportunity" || attachmentTarget === "project") && !selectedId) ||
      (attachmentTarget === "company" &&
        attachmentRelationKind !== "none" &&
        !attachmentRelationId)
    );
  const attachmentBlockingReason =
    attachmentTarget === "company" && !attachmentCompanyId
      ? "Select a company for filing."
      : (attachmentTarget === "opportunity" || attachmentTarget === "project") && !selectedId
        ? `Select a ${attachmentTarget} in the Tag mail section first.`
        : attachmentTarget === "company" &&
            attachmentRelationKind !== "none" &&
            !attachmentRelationId
          ? `Select the related ${attachmentRelationKind}.`
          : null;
  const destinationSummary =
    attachmentTarget === "company"
      ? attachmentRelationKind === "none" || !relationLabel
        ? `Attachments will be stored under ${selectedCompanyLabel}.`
        : `Attachments will be stored under ${selectedCompanyLabel} and related to ${relationLabel}.`
      : selectedTagLabel
        ? `Attachments will be stored under ${selectedTagLabel}.`
        : `Select a ${attachmentTarget} in Tag mail to file attachments there.`;

  const saveSelectedMails = async (link?: {
    opportunityId?: string | null;
    projectId?: string | null;
  }) => {
    if (!context?.contactId || seeds.length === 0) return;
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
          messages: seeds.map((row) => ({
            conversationId: row.conversationId,
            message: {
              externalMessageId: row.externalMessageId,
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
      if (saved === 0) {
        throw new Error("Could not save these mails for the matched contact.");
      }
      setStatus(
        failed > 0
          ? `Saved ${saved} of ${payload.total ?? seeds.length} mails on ${context.companyName}.`
          : saved === 1
            ? `Saved on ${context.companyName} in SmartCRM.`
            : `Saved ${saved} mails on ${context.companyName} in SmartCRM.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save mail");
    } finally {
      setBusy(false);
    }
  };

  const markRelationshipInOutlook = async () => {
    await saveSelectedMails();
  };

  const applyTag = async () => {
    if (!selectedId) return;
    await saveSelectedMails(
      linkKind === "project"
        ? { projectId: selectedId }
        : { opportunityId: selectedId },
    );
  };

  const syncAttachmentsToSmartDocs = async () => {
    if (seeds.length === 0) return;
    setSyncBusy(true);
    setSyncError(null);
    setSyncStatus(null);
    setReviewStatus(null);
    setReviewError(null);
    try {
      const emailExternalMessageIds = seeds
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
          ...(attachmentTarget === "company" && attachmentCompanyId
            ? { companyId: attachmentCompanyId }
            : {}),
          ...(attachmentTarget === "opportunity" && selectedId
            ? { opportunityId: selectedId }
            : {}),
          ...(attachmentTarget === "project" && selectedId ? { projectId: selectedId } : {}),
          ...(attachmentTarget === "company" &&
          attachmentRelationKind === "opportunity" &&
          attachmentRelationId
            ? { opportunityId: attachmentRelationId }
            : {}),
          ...(attachmentTarget === "company" &&
          attachmentRelationKind === "project" &&
          attachmentRelationId
            ? { projectId: attachmentRelationId }
            : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        documentsSaved?: number;
        fetchedAttachments?: number;
        documents?: Array<{
          id: string;
          name: string;
          docCategory: SmartDocCategory;
          docType: string;
        }>;
      };

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not sync attachments");
      }

      const saved = payload.documentsSaved ?? 0;
      const fetched = payload.fetchedAttachments ?? 0;
      setSyncStatus(
        saved > 0
          ? `${destinationSummary} Filed ${saved} attachment(s) into SmartDocs (${fetched} fetched).`
          : `No attachments were filed into SmartDocs (${fetched} fetched).`,
      );
      setReviewDocs(Array.isArray(payload.documents) ? payload.documents.slice(0, 20) : []);
    } catch (syncErr) {
      setSyncError(
        syncErr instanceof Error ? syncErr.message : "Could not file attachments",
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const saveReviewClassification = async () => {
    if (reviewDocs.length === 0) return;
    setReviewBusy(true);
    setReviewError(null);
    setReviewStatus(null);
    try {
      const response = await fetch("/api/m365/sync-attachments/classification", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        credentials: "include",
        body: JSON.stringify({
          updates: reviewDocs.map((doc) => ({
            documentId: doc.id,
            docCategory: doc.docCategory,
            docType: doc.docType,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        updated?: number;
        failed?: number;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not update classification");
      }
      setReviewStatus(
        payload.failed && payload.failed > 0
          ? `Updated ${payload.updated ?? 0} file(s); ${payload.failed} failed.`
          : `Updated classification for ${payload.updated ?? reviewDocs.length} file(s).`,
      );
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Could not update category and type",
      );
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <p className="text-[11px] text-carbon-blue/45">Loading mail tag options…</p>
      </div>
    );
  }

  if (!context) {
    return error ? (
      <div className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <p className="text-[11px] text-thermal-red">{error}</p>
      </div>
    ) : null;
  }

  return (
    <div className="border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Tag mail
      </p>
      <p className="mt-1 text-[11px] leading-snug text-carbon-blue/55">
        {selectedCount > 1
          ? `${selectedCount} mails selected. Save them onto this contact, or tag all to a project${
              opportunityTagging ? " or opportunity" : ""
            }.`
          : opportunityTagging
            ? "Save this mail onto the contact, or tag the thread to an opportunity or project."
            : `${context.companyName} is not sell-to — link this mail to a project (e.g. Escalante), or save it on the company. Opportunity stays hidden.`}
      </p>
      <SelectedMailSubjects seeds={seeds} />

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
            title={
              entry.enabled
                ? undefined
                : "Opportunities are only for sell-to relationships (Customer / Prospect / Offtaker)."
            }
            onClick={() => {
              if (!entry.enabled) return;
              setLinkKind(entry.kind);
              setSelectedId("");
              setStatus(null);
            }}
            className={`flex-1 border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 ${
              linkKind === entry.kind
                ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                : "border-carbon-blue/15 bg-white text-carbon-blue/50"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {linkKind === "opportunity" ? "Opportunity" : "Project"}
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-col gap-1.5">
        {seed ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markRelationshipInOutlook()}
              className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : selectedCount > 1
                  ? `Save ${selectedCount} mails in SmartCRM`
                  : "Save mail in SmartCRM"}
            </button>
            <button
              type="button"
              disabled={!selectedId || busy}
              onClick={() => void applyTag()}
              className="inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
            >
              {busy
                ? "Tagging…"
                : selectedCount > 1
                  ? `Tag ${selectedCount} threads`
                  : "Tag this thread"}
            </button>
          </>
        ) : (
          <p className="text-[10px] text-carbon-blue/45">
            Select one or more mails in Outlook, then save them here.
          </p>
        )}

        {seed ? (
          <>
            <AttachmentFilingControls
              attachmentTarget={attachmentTarget}
              setAttachmentTarget={setAttachmentTarget}
              attachmentCompanyId={attachmentCompanyId}
              setAttachmentCompanyId={setAttachmentCompanyId}
              attachmentRelationKind={attachmentRelationKind}
              setAttachmentRelationKind={setAttachmentRelationKind}
              attachmentRelationId={attachmentRelationId}
              setAttachmentRelationId={setAttachmentRelationId}
              selectedId={selectedId}
              linkKind={linkKind}
              selectedTagLabel={selectedTagLabel}
              destinationSummary={destinationSummary}
              companyOptions={companyOptions}
              opportunityOptions={
                opportunityTagging ? context.opportunityOptions : []
              }
              projectOptions={context.projectOptions}
              allowOpportunity={opportunityTagging}
            />
            <button
              type="button"
              disabled={!canFileAttachments}
              onClick={() => void syncAttachmentsToSmartDocs()}
              className="inline-flex items-center justify-center border border-carbon-blue/15 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
            >
              {syncBusy ? "Filing attachments…" : `File attachments (${selectedCount})`}
            </button>
            {attachmentBlockingReason ? (
              <p className="mt-1 text-[10px] text-carbon-blue/45">{attachmentBlockingReason}</p>
            ) : null}
          </>
        ) : null}

        <DraftInOutlookButton
          toEmail={email}
          subject={
            linkKind === "project"
              ? `Re: ${options.find((row) => row.id === selectedId)?.name ?? "project"}`
              : `Re: ${options.find((row) => row.id === selectedId)?.name ?? "opportunity"}`
          }
          bodyHtml="<p>Hi,</p><p></p><p>Best regards</p>"
          opportunityId={linkKind === "opportunity" ? selectedId || undefined : undefined}
          projectId={linkKind === "project" ? selectedId || undefined : undefined}
          role={role}
          disabled={!selectedId}
          label="New tagged mail"
          className="inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
        />
      </div>

      {status ? <p className="mt-1.5 text-[10px] text-emerald-700">{status}</p> : null}
      {syncStatus ? <p className="mt-1.5 text-[10px] text-emerald-700">{syncStatus}</p> : null}
      {reviewDocs.length > 0 ? (
        <FiledDocumentsReviewPanel
          docs={reviewDocs}
          setDocs={setReviewDocs}
          onSave={saveReviewClassification}
          busy={reviewBusy}
          status={reviewStatus}
          error={reviewError}
        />
      ) : null}
      {error ? <p className="mt-1.5 text-[10px] text-thermal-red">{error}</p> : null}
      {syncError ? <p className="mt-1.5 text-[10px] text-thermal-red">{syncError}</p> : null}
    </div>
  );
}

function FiledDocumentsReviewPanel({
  docs,
  setDocs,
  onSave,
  busy,
  status,
  error,
}: {
  docs: FiledDocumentReview[];
  setDocs: React.Dispatch<React.SetStateAction<FiledDocumentReview[]>>;
  onSave: () => Promise<void>;
  busy: boolean;
  status: string | null;
  error: string | null;
}) {
  return (
    <div className="mt-2 border border-carbon-blue/10 bg-white px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
        Review category and type
      </p>
      <p className="mt-1 text-[10px] text-carbon-blue/55">
        SmartAssist suggested values. Adjust if needed, then save.
      </p>
      <div className="mt-2 max-h-56 space-y-2 overflow-auto">
        {docs.map((doc) => {
          const types = SMARTDOC_TYPES_BY_CATEGORY[doc.docCategory];
          return (
            <div key={doc.id} className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-2">
              <p className="truncate text-[10px] font-medium text-carbon-blue/70">{doc.name}</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <select
                  value={doc.docCategory}
                  onChange={(event) => {
                    const nextCategory = event.target.value as SmartDocCategory;
                    const nextTypes = SMARTDOC_TYPES_BY_CATEGORY[nextCategory];
                    setDocs((current) =>
                      current.map((row) =>
                        row.id === doc.id
                          ? {
                              ...row,
                              docCategory: nextCategory,
                              docType: nextTypes.includes(row.docType)
                                ? row.docType
                                : nextTypes[0] ?? row.docType,
                            }
                          : row,
                      ),
                    );
                  }}
                  className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue"
                >
                  {SMARTDOC_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={doc.docType}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setDocs((current) =>
                      current.map((row) =>
                        row.id === doc.id ? { ...row, docType: nextType } : row,
                      ),
                    );
                  }}
                  className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] text-carbon-blue"
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSave()}
        className="mt-2 inline-flex w-full items-center justify-center border border-carbon-blue/15 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
      >
        {busy ? "Saving classification…" : "Save category and type"}
      </button>
      {status ? <p className="mt-1 text-[10px] text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-1 text-[10px] text-thermal-red">{error}</p> : null}
    </div>
  );
}

function SelectedMailSubjects({ seeds }: { seeds: OutlookOpenMessageSeed[] }) {
  if (seeds.length <= 1) return null;
  return (
    <ul className="mt-2 max-h-28 overflow-auto text-[11px] leading-snug text-carbon-blue/60">
      {seeds.slice(0, 8).map((row) => (
        <li key={row.externalMessageId} className="truncate">
          {typeof row.subject === "string" ? row.subject : "(no subject)"}
        </li>
      ))}
    </ul>
  );
}

function AttachmentFilingControls({
  attachmentTarget,
  setAttachmentTarget,
  attachmentCompanyId,
  setAttachmentCompanyId,
  attachmentRelationKind,
  setAttachmentRelationKind,
  attachmentRelationId,
  setAttachmentRelationId,
  selectedId,
  linkKind,
  selectedTagLabel,
  destinationSummary,
  companyOptions,
  opportunityOptions,
  projectOptions,
  allowOpportunity = true,
}: {
  attachmentTarget: "company" | "opportunity" | "project";
  setAttachmentTarget: (value: "company" | "opportunity" | "project") => void;
  attachmentCompanyId: string;
  setAttachmentCompanyId: (value: string) => void;
  attachmentRelationKind: "none" | "opportunity" | "project";
  setAttachmentRelationKind: (value: "none" | "opportunity" | "project") => void;
  attachmentRelationId: string;
  setAttachmentRelationId: (value: string) => void;
  selectedId: string;
  linkKind: "opportunity" | "project";
  selectedTagLabel: string;
  destinationSummary: string;
  companyOptions: LinkOption[];
  opportunityOptions: LinkOption[];
  projectOptions: LinkOption[];
  allowOpportunity?: boolean;
}) {
  const relationOptions =
    attachmentRelationKind === "project" ? projectOptions : opportunityOptions;
  const canUseCurrentTag = selectedId.length > 0;
  return (
    <div className="mt-2 border border-carbon-blue/10 bg-white px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
        Attachment filing
      </p>
      <p className="mt-1 text-[10px] leading-snug text-carbon-blue/70 font-semibold">
        {destinationSummary}
      </p>
      <label className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Where to store
        <select
          value={attachmentTarget}
          onChange={(event) =>
            setAttachmentTarget(event.target.value as "company" | "opportunity" | "project")
          }
          className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
        >
          <option value="company">Company</option>
          {allowOpportunity ? <option value="opportunity">Opportunity</option> : null}
          <option value="project">Project</option>
        </select>
      </label>
      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={() => setAttachmentTarget("company")}
          className="flex-1 border border-carbon-blue/15 bg-white px-2 py-1 text-[10px] font-semibold text-carbon-blue/70 hover:border-upcycle-orange hover:text-upcycle-orange"
        >
          Store under company
        </button>
        <button
          type="button"
          disabled={!canUseCurrentTag}
          onClick={() => setAttachmentTarget(linkKind)}
          className="flex-1 border border-carbon-blue/15 bg-white px-2 py-1 text-[10px] font-semibold text-carbon-blue/70 hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
        >
          Use selected {linkKind === "opportunity" ? "opportunity" : "project"}
        </button>
      </div>
      {attachmentTarget === "company" ? (
        <>
          <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Company
            <select
              value={attachmentCompanyId}
              onChange={(event) => setAttachmentCompanyId(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
            >
              <option value="">Select company…</option>
              {companyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Related to (optional)
            <select
              value={attachmentRelationKind}
              onChange={(event) => {
                setAttachmentRelationKind(
                  event.target.value as "none" | "opportunity" | "project",
                );
                setAttachmentRelationId("");
              }}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
            >
              <option value="none">No relation</option>
              {allowOpportunity ? <option value="opportunity">Opportunity</option> : null}
              <option value="project">Project</option>
            </select>
          </label>
          {attachmentRelationKind !== "none" ? (
            <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {attachmentRelationKind === "project" ? "Project" : "Opportunity"}
              <select
                value={attachmentRelationId}
                onChange={(event) => setAttachmentRelationId(event.target.value)}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
              >
                <option value="">Select…</option>
                {relationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-[10px] text-carbon-blue/50">
          Will use the selected {attachmentTarget} from the Tag mail section.
          {!selectedId
            ? " Select one first."
            : selectedTagLabel
              ? ` Current: ${selectedTagLabel}.`
              : ""}
        </p>
      )}
    </div>
  );
}
