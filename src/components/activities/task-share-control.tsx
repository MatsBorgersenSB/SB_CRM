"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, Mail, Share2, X } from "lucide-react";
import {
  isTaskSharedWithUser,
  mergeSharedWith,
  taskAbsoluteUrl,
  taskShareMailtoHref,
} from "@/lib/task-sharing";
import { findStandardBioUserOption } from "@/lib/standard-bio-users";
import type { Activity } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";

/**
 * Share a task with colleagues (watchers) + copy link / email.
 */
export function TaskShareControl({
  activity,
  options,
  currentUser,
  onSharedWithChange,
  compact = false,
}: {
  activity: Activity;
  options: SharePointPerson[];
  currentUser?: SharePointPerson | null;
  onSharedWithChange: (sharedWith: SharePointPerson[]) => Promise<void> | void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickId, setPickId] = useState("");

  const shared = activity.SharedWith ?? [];
  const assigneeId = activity.ActivityOwner?.Id;

  const shareOptions = useMemo(
    () =>
      options.filter(
        (person) =>
          person.Id !== assigneeId &&
          !shared.some((entry) => entry.Id === person.Id),
      ),
    [options, assigneeId, shared],
  );

  const sharedWithMe =
    currentUser && isTaskSharedWithUser(activity, currentUser);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(taskAbsoluteUrl(activity.ActivityID));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link.");
    }
  };

  const addPerson = async () => {
    const person = findStandardBioUserOption(options, Number(pickId));
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await onSharedWithChange(mergeSharedWith(shared, [person]));
      setPickId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share task.");
    } finally {
      setBusy(false);
    }
  };

  const removePerson = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await onSharedWithChange(mergeSharedWith(shared, [], [id]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sharing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? "inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
            : "inline-flex items-center gap-1.5 border border-carbon-blue/15 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70 hover:border-upcycle-orange hover:text-upcycle-orange"
        }
      >
        <Share2 className="size-3" strokeWidth={2} />
        Share
        {shared.length > 0 ? (
          <span className="text-carbon-blue/40">({shared.length})</span>
        ) : null}
        {sharedWithMe ? (
          <span className="text-[9px] font-medium normal-case text-upcycle-orange">
            with you
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-72 border border-carbon-blue/15 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-carbon-blue">Share task</p>
              <p className="mt-0.5 text-[10px] text-carbon-blue/50">
                Colleagues can follow this task. Assignee stays the owner.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-carbon-blue/40 hover:text-carbon-blue"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={pickId}
              disabled={busy || shareOptions.length === 0}
              onChange={(event) => setPickId(event.target.value)}
              className="min-w-0 flex-1 border border-carbon-blue/15 px-2 py-1.5 text-[11px]"
            >
              <option value="">
                {shareOptions.length === 0 ? "Everyone already shared" : "Add colleague…"}
              </option>
              {shareOptions.map((person) => (
                <option key={person.Id} value={person.Id}>
                  {person.Title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !pickId}
              onClick={() => void addPerson()}
              className="border border-upcycle-orange bg-upcycle-orange px-2 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {shared.length > 0 ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
              {shared.map((person) => (
                <li
                  key={person.Id}
                  className="flex items-center justify-between gap-2 text-[11px] text-carbon-blue/75"
                >
                  <span className="truncate">{person.Title}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removePerson(person.Id)}
                    className="text-[10px] font-semibold text-carbon-blue/40 hover:text-thermal-red"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[10px] text-carbon-blue/45">Not shared with anyone yet.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-carbon-blue/8 pt-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-blue/60 hover:text-upcycle-orange"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={taskShareMailtoHref(activity)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-blue/60 hover:text-upcycle-orange"
            >
              <Mail className="size-3" />
              Email
            </a>
            <a
              href={taskAbsoluteUrl(activity.ActivityID)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-blue/60 hover:text-upcycle-orange"
            >
              <Link2 className="size-3" />
              Open
            </a>
          </div>

          {error ? <p className="mt-2 text-[10px] text-thermal-red">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Multi-select for sharing at create time. */
export function TaskShareWithPicker({
  value,
  onChange,
  options,
  excludeIds = [],
  disabled = false,
}: {
  value: SharePointPerson[];
  onChange: (next: SharePointPerson[]) => void;
  options: SharePointPerson[];
  excludeIds?: number[];
  disabled?: boolean;
}) {
  const available = options.filter(
    (person) =>
      !excludeIds.includes(person.Id) && !value.some((entry) => entry.Id === person.Id),
  );

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40">
        Share with
      </span>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((person) => (
            <li
              key={person.Id}
              className="inline-flex items-center gap-1 border border-carbon-blue/15 bg-carbon-blue/[0.03] px-2 py-0.5 text-[11px] text-carbon-blue"
            >
              {person.Title}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((entry) => entry.Id !== person.Id))}
                className="text-carbon-blue/40 hover:text-thermal-red"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <select
        value=""
        disabled={disabled || available.length === 0}
        onChange={(event) => {
          const person = findStandardBioUserOption(options, Number(event.target.value));
          if (person) onChange([...value, person]);
        }}
        className="w-full border border-carbon-blue/15 px-2.5 py-2 text-[12px]"
      >
        <option value="">
          {available.length === 0 ? "No more colleagues to add" : "Add colleague…"}
        </option>
        {available.map((person) => (
          <option key={person.Id} value={person.Id}>
            {person.Title}
          </option>
        ))}
      </select>
      <p className="text-[9px] text-carbon-blue/40">
        Shared colleagues can follow the task. Assign to remains the owner.
      </p>
    </div>
  );
}
