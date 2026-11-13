"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarPlus,
  ChevronRight,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Mail,
  Presentation,
  Upload,
  Plus,
} from "lucide-react";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { useAuth } from "@/context/auth-context";
import {
  activityPresetForPath,
  documentsUrlForCompany,
  goAddDocument,
  markAddDocumentPending,
} from "@/lib/add-document-intent";
import { cn } from "@/lib/cn";
import { markDocumentIntent } from "@/lib/create-document-intent";
import { outlookMeetingComposeHref } from "@/lib/compose-actions";
import { outlookComposeUrl } from "@/lib/outlook-compose-link";
import type { CreateActivityInput } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

type MenuBox = { top: number; left: number; maxHeight: number };

function placeMenu(anchor: DOMRect, align: "left" | "right"): MenuBox {
  const width = 260;
  const margin = 8;
  const top = anchor.bottom + 4;
  const left =
    align === "right"
      ? Math.max(margin, Math.min(anchor.right - width, window.innerWidth - width - margin))
      : Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin));
  const maxHeight = Math.max(160, window.innerHeight - top - margin);
  return { top, left, maxHeight };
}

type PickableCompany = { CompanyID: string; Title: string };

function CompanyPicker({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (company: PickableCompany) => void;
}) {
  const [companies, setCompanies] = useState<PickableCompany[] | null>(null);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    let cancelled = false;
    fetch("/api/companies", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((rows: PickableCompany[]) => {
        if (!cancelled) setCompanies(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (companies ?? [])
      .filter((company) => !needle || company.Title.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [companies, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Which company"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl"
      >
        <p className="mb-2 text-sm font-semibold text-foreground">Which company is it for?</p>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search companies…"
          className="mb-2 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs"
        />
        {failed ? (
          <p className="text-xs text-muted-foreground">
            Could not load companies. Open a company and create from there.
          </p>
        ) : companies === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">No company matches.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {matches.map((company) => (
              <li key={company.CompanyID}>
                <button
                  type="button"
                  onClick={() => onChoose(company)}
                  className="w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-accent/80"
                >
                  {company.Title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type DocumentAction =
  | { kind: "memo" }
  | { kind: "presentation" }
  | { kind: "spreadsheet" }
  | { kind: "upload" }
  | { kind: "other" };

/**
 * One Create control: Activity · Mail · Meeting · Document (Memo / Presentation / Spreadsheet / Upload).
 * Always visible — never behind Overview / Understanding / Work tabs.
 */
export function CreateMenu({
  showMail = true,
  variant = "sidebar",
  className,
  /** When set, skip path detection and use this activity preset. */
  activityPreset,
  companies: companiesProp,
  pipelines: pipelinesProp,
  mailTo,
  meetingSubject,
}: {
  showMail?: boolean;
  variant?: "sidebar" | "header";
  className?: string;
  activityPreset?: Partial<CreateActivityInput>;
  companies?: Company[];
  pipelines?: PipelineRow[];
  mailTo?: string;
  meetingSubject?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const [picking, setPicking] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<DocumentAction | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [fetchedCompanies, setFetchedCompanies] = useState<Company[] | null>(null);
  const [fetchedPipelines, setFetchedPipelines] = useState<PipelineRow[] | null>(null);
  const activityCompanies = companiesProp ?? fetchedCompanies;
  const activityPipelines = pipelinesProp ?? fetchedPipelines;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!creatingActivity) return;
    if (activityCompanies !== null && activityPipelines !== null) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/companies", { credentials: "include" }).then((res) =>
        res.ok ? res.json() : [],
      ),
      fetch("/api/pipelines", { credentials: "include" }).then((res) =>
        res.ok ? res.json() : [],
      ),
    ])
      .then(([companies, pipelines]) => {
        if (cancelled) return;
        setFetchedCompanies(Array.isArray(companies) ? (companies as Company[]) : []);
        setFetchedPipelines(Array.isArray(pipelines) ? (pipelines as PipelineRow[]) : []);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedCompanies((current) => current ?? []);
        setFetchedPipelines((current) => current ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [creatingActivity, activityCompanies, activityPipelines]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      if (!rootRef.current) return;
      setBox(placeMenu(rootRef.current.getBoundingClientRect(), variant === "header" ? "right" : "left"));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, docsOpen, variant]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setDocsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (docsOpen) setDocsOpen(false);
        else setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, docsOpen]);

  const pathPreset = useMemo(
    () => activityPresetForPath(pathname, activityCompanies ?? []),
    [pathname, activityCompanies],
  );
  const resolvedPreset = activityPreset ?? pathPreset;

  const presetKey = [
    resolvedPreset.Company && "CompanyID" in resolvedPreset.Company
      ? resolvedPreset.Company.CompanyID
      : "",
    resolvedPreset.Contact && "ContactID" in resolvedPreset.Contact
      ? resolvedPreset.Contact.ContactID
      : "",
    resolvedPreset.Deal && "DealID" in resolvedPreset.Deal
      ? resolvedPreset.Deal.DealID
      : "",
    resolvedPreset.ProjectId ?? "",
  ].join("|");

  const runDocument = (action: DocumentAction) => {
    setOpen(false);
    setDocsOpen(false);
    const intent =
      action.kind === "upload" || action.kind === "spreadsheet"
        ? { mode: "import" as const }
        : {
            mode: "create" as const,
            type:
              action.kind === "memo"
                ? "Memo"
                : action.kind === "presentation"
                  ? "Presentation"
                  : action.kind === "other"
                    ? undefined
                    : "Calculation",
          };
    const result = goAddDocument(pathname, intent, (url) => router.push(url));
    if (result === "needs-company") {
      setPendingDoc(action);
      setPicking(true);
    }
  };

  const mailHref = mailTo
    ? `mailto:${mailTo}`
    : outlookComposeUrl();

  const meetingHref = outlookMeetingComposeHref(
    mailTo ? [mailTo] : [],
    meetingSubject ?? "Meeting",
  );

  const triggerClass =
    variant === "sidebar"
      ? cn(
          "flex w-full items-center justify-center gap-2 rounded-md border border-upcycle-orange bg-upcycle-orange px-2.5 py-2 md:justify-start",
          "text-left text-xs font-semibold text-white transition-colors hover:bg-upcycle-orange/90",
        )
      : cn(
          "inline-flex shrink-0 items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5",
          "text-[12px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90",
        );

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-carbon-blue hover:bg-carbon-blue/[0.04]";

  return (
    <>
      <div ref={rootRef} className={cn("relative", className)}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Create"
          title="Create activity, mail, meeting, or document"
          onClick={() => {
            setDocsOpen(false);
            setOpen((value) => !value);
          }}
          className={triggerClass}
        >
          <Plus className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className={variant === "sidebar" ? "hidden md:inline" : undefined}>Create</span>
        </button>
        {open && box
          ? createPortal(
              <div
                ref={menuRef}
                role="menu"
                aria-label="Create"
                style={{ top: box.top, left: box.left, maxHeight: box.maxHeight }}
                className="fixed z-[80] min-w-[16rem] overflow-y-auto border border-carbon-blue/15 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    setCreatingActivity(true);
                  }}
                >
                  <CalendarPlus className="size-3.5 text-upcycle-orange" strokeWidth={2} />
                  Activity
                </button>
                {showMail ? (
                  <a role="menuitem" href={mailHref} className={itemClass} onClick={() => setOpen(false)}>
                    <Mail className="size-3.5 text-upcycle-orange" strokeWidth={2} />
                    Mail
                  </a>
                ) : null}
                <a
                  role="menuitem"
                  href={meetingHref}
                  className={itemClass}
                  onClick={() => setOpen(false)}
                >
                  <CalendarPlus className="size-3.5 text-upcycle-orange" strokeWidth={2} />
                  Meeting
                </a>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(itemClass, "justify-between")}
                  onClick={() => setDocsOpen((value) => !value)}
                  aria-expanded={docsOpen}
                >
                  <span className="inline-flex items-center gap-2">
                    <FilePlus2 className="size-3.5 text-upcycle-orange" strokeWidth={2} />
                    Document
                  </span>
                  <ChevronRight className="size-3.5 text-carbon-blue/40" />
                </button>
                {docsOpen ? (
                  <div className="border-t border-carbon-blue/10 bg-carbon-blue/[0.02] py-1">
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClass}
                      onClick={() => runDocument({ kind: "memo" })}
                    >
                      <FileText className="size-3.5" strokeWidth={2} />
                      Memo
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClass}
                      onClick={() => runDocument({ kind: "presentation" })}
                    >
                      <Presentation className="size-3.5" strokeWidth={2} />
                      Presentation
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClass}
                      onClick={() => runDocument({ kind: "spreadsheet" })}
                    >
                      <FileSpreadsheet className="size-3.5" strokeWidth={2} />
                      Spreadsheet
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClass}
                      onClick={() => runDocument({ kind: "upload" })}
                    >
                      <Upload className="size-3.5" strokeWidth={2} />
                      Upload
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={itemClass}
                      onClick={() => runDocument({ kind: "other" })}
                    >
                      <FilePlus2 className="size-3.5" strokeWidth={2} />
                      Other SmartDoc…
                    </button>
                  </div>
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </div>

      {picking ? (
        <CompanyPicker
          onClose={() => {
            setPicking(false);
            setPendingDoc(null);
          }}
          onChoose={(company) => {
            const action = pendingDoc ?? { kind: "upload" as const };
            const intent =
              action.kind === "upload" || action.kind === "spreadsheet"
                ? { mode: "import" as const }
                : {
                    mode: "create" as const,
                    type:
                      action.kind === "memo"
                        ? "Memo"
                        : action.kind === "presentation"
                          ? "Presentation"
                          : undefined,
                  };
            markAddDocumentPending();
            markDocumentIntent(intent);
            setPicking(false);
            setPendingDoc(null);
            router.push(documentsUrlForCompany(company.CompanyID));
            window.setTimeout(() => {
              window.dispatchEvent(new Event("smartcrm:add-document"));
              window.dispatchEvent(
                new CustomEvent("smartcrm:document-intent", { detail: intent }),
              );
            }, 0);
          }}
        />
      ) : null}

      <ActivityCreateWizard
        key={presetKey}
        open={creatingActivity}
        onClose={() => setCreatingActivity(false)}
        onCreated={() => {
          setCreatingActivity(false);
          router.refresh();
        }}
        companies={activityCompanies ?? []}
        pipelines={activityPipelines ?? []}
        preset={resolvedPreset}
        defaultOwner={user}
      />
    </>
  );
}
