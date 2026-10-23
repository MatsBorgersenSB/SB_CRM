"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FilePlus2, FileText, Mail, PenSquare, X } from "lucide-react";
import {
  ADD_DOCUMENT_EVENT,
  documentsUrlForCompany,
  documentsUrlForPath,
  markAddDocumentPending,
} from "@/lib/add-document-intent";
import { cn } from "@/lib/cn";
import { outlookComposeUrl } from "@/lib/outlook-compose-link";

const ACTION_CLASS = cn(
  "flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/60 bg-muted/50 px-2 py-2",
  "text-left text-[11px] font-medium text-foreground transition-colors",
  "hover:border-border hover:bg-accent/80",
);

type PickableCompany = { CompanyID: string; Title: string };

/** Asked only when no record is open: documents belong to a company, so pick it. */
function CompanyPicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
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

  const choose = (company: PickableCompany) => {
    markAddDocumentPending();
    onClose();
    router.push(documentsUrlForCompany(company.CompanyID));
  };

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
        aria-label="Add document"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Which company is it for?</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search companies…"
          className="mb-2 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs"
        />
        {failed ? (
          <p className="text-xs text-muted-foreground">
            Could not load companies. Open a company and use Add document there.
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
                  onClick={() => choose(company)}
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

/**
 * Create mail · View mail · Add document · View documents.
 * Always visible in the sidebar so none of them is ever more than one click away.
 */
export function QuickActions({ showMail = true }: { showMail?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  const addDocument = () => {
    const target = documentsUrlForPath(pathname);
    if (!target) {
      setPicking(true);
      return;
    }
    markAddDocumentPending();
    const [path = "", hash] = target.split("#");
    if (hash && path === window.location.pathname) {
      // Same record: change the hash in place so the collapsed documents area
      // opens and scrolls into view (clearing it first so a repeat click still fires).
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.location.hash = hash;
    } else {
      router.push(target);
    }
    // If the documents panel is already on screen it opens upload now; otherwise it
    // reads the pending flag when it mounts.
    window.dispatchEvent(new Event(ADD_DOCUMENT_EVENT));
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5" aria-label="Quick actions">
        {showMail ? (
          <a
          href={outlookComposeUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_CLASS}
          title="Write a new mail in Outlook"
        >
          <PenSquare className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
          New mail
        </a>
        ) : null}
        {showMail ? (
        <Link href="/mail" className={ACTION_CLASS} title="Recent mail tied to your relationships">
          <Mail className="size-3.5 shrink-0" strokeWidth={2} />
          Mail
        </Link>
        ) : null}
        <button
          type="button"
          onClick={addDocument}
          className={ACTION_CLASS}
          title="Add a document to the record you are viewing"
        >
          <FilePlus2 className="size-3.5 shrink-0 text-primary" strokeWidth={2} />
          Add doc
        </button>
        <Link href="/knowledge" className={ACTION_CLASS} title="All documents">
          <FileText className="size-3.5 shrink-0" strokeWidth={2} />
          Docs
        </Link>
      </div>
      {picking ? <CompanyPicker onClose={() => setPicking(false)} /> : null}
    </>
  );
}
