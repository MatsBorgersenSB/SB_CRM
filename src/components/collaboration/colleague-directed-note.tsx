"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { findStandardBioUserOption } from "@/lib/standard-bio-users";
import type { SharePointPerson } from "@/types/company";
import type { DirectedNoteEntityKind } from "@/types/colleague-note";

type ColleagueDirectedNoteProps = {
  kind: DirectedNoteEntityKind;
  entityId: string;
  subject: string;
  options: SharePointPerson[];
  compact?: boolean;
  /** Prefill “what do you need?” — e.g. the ask from a mail. */
  defaultMessage?: string;
  /** Prefill optional link — e.g. Outlook webLink. */
  defaultLinkUrl?: string;
  /** Override the orange button label. */
  buttonLabel?: string;
};

type PendingFile = {
  name: string;
  contentType: string;
  contentBase64: string;
};

const MAX_ATTACHMENT_BYTES = 4_500_000;

/**
 * Primary teammate CTA. Who + what + optional link/file + Send.
 */
export function ColleagueDirectedNote({
  kind,
  entityId,
  subject,
  options,
  compact = false,
  defaultMessage = "",
  defaultLinkUrl = "",
  buttonLabel = "Ask a teammate",
}: ColleagueDirectedNoteProps) {
  const [open, setOpen] = useState(false);
  const [colleagueId, setColleagueId] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [linkUrl, setLinkUrl] = useState(defaultLinkUrl);
  const [file, setFile] = useState<PendingFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = useMemo(
    () => Boolean(colleagueId) && message.trim().length > 0 && !busy,
    [colleagueId, message, busy],
  );

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setError("File is too big — keep it under about 4 MB");
      return;
    }
    setError(null);
    try {
      const contentBase64 = await readFileAsBase64(picked);
      setFile({
        name: picked.name,
        contentType: picked.type || "application/octet-stream",
        contentBase64,
      });
    } catch {
      setError("Could not read that file");
    }
  };

  const send = async () => {
    const person = findStandardBioUserOption(options, Number(colleagueId));
    if (!person || !canSend) return;
    const note = message.trim();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/colleague-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          entityId,
          subject,
          note,
          impact:
            kind === "mail"
              ? `A customer mail needs an answer they cannot give alone.`
              : `They are waiting on help with ${subject}.`,
          nextAction:
            kind === "mail"
              ? `Open the mail in SmartCRM and help draft or send the reply.`
              : `Open ${subject} and do what was asked.`,
          colleagueId: person.Id,
          colleagueTitle: person.Title,
          colleagueEmail: person.Email ?? null,
          linkUrl: linkUrl.trim() || null,
          attachment: file,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Could not send");
      }
      setSent(true);
      setMessage("");
      setLinkUrl("");
      setFile(null);
      setColleagueId("");
      window.setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const toggleOpen = () => {
    setOpen((value) => {
      const next = !value;
      if (next) {
        if (!message.trim() && defaultMessage.trim()) setMessage(defaultMessage);
        if (!linkUrl.trim() && defaultLinkUrl.trim()) setLinkUrl(defaultLinkUrl);
      }
      return next;
    });
  };

  return (
    <div className={compact ? "relative inline-flex flex-col items-start" : "w-full max-w-xl"}>
      <button
        type="button"
        onClick={toggleOpen}
        className={
          compact
            ? "inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
            : "inline-flex min-h-11 w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-5 py-3 text-[16px] font-semibold text-white hover:opacity-90 sm:w-auto"
        }
      >
        {open ? "Close" : buttonLabel}
      </button>

      {open ? (
        <div
          className={
            compact
              ? "absolute left-0 top-full z-30 mt-1 w-[min(100vw-2rem,22rem)] border border-carbon-blue/15 bg-white p-4 shadow-lg"
              : "mt-3 w-full border border-carbon-blue/15 bg-white p-4 shadow-sm"
          }
        >
          <p className="text-[15px] font-semibold text-carbon-blue">{buttonLabel}</p>
          <p className="mt-1 text-[13px] text-carbon-blue/55">
            {kind === "mail"
              ? "Can't answer this alone? Pick who can help. Optional: add a link or a file."
              : "Pick who. Say what you need. Optional: add a link or a file."}
          </p>

          <label className="mt-3 block text-[13px] font-medium text-carbon-blue">
            Who?
            <select
              value={colleagueId}
              onChange={(event) => setColleagueId(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2.5 text-[14px]"
            >
              <option value="">Pick a person…</option>
              {options.map((person) => (
                <option key={person.Id} value={person.Id}>
                  {person.Title}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-[13px] font-medium text-carbon-blue">
            What do you need?
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2.5 text-[14px]"
              placeholder="e.g. Please check the feedstock numbers before Friday"
            />
          </label>

          <label className="mt-3 block text-[13px] font-medium text-carbon-blue">
            Link (optional)
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2.5 text-[14px]"
              placeholder="https://…"
            />
          </label>

          <div className="mt-3">
            <p className="text-[13px] font-medium text-carbon-blue">File (optional)</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] font-medium text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange">
                {file ? "Change file…" : "Add a file…"}
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => void onPickFile(event)}
                />
              </label>
              {file ? (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-[13px] text-carbon-blue/60 hover:text-thermal-red"
                >
                  Remove {file.name}
                </button>
              ) : (
                <span className="text-[12px] text-carbon-blue/45">Max about 4 MB</span>
              )}
            </div>
          </div>

          {error ? <p className="mt-2 text-[13px] text-thermal-red">{error}</p> : null}
          {sent ? (
            <p className="mt-2 text-[13px] font-medium text-emerald-700">Sent — they got a ping</p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-[13px] text-carbon-blue/60 hover:text-carbon-blue"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void send()}
              className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      if (!base64) {
        reject(new Error("empty"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
