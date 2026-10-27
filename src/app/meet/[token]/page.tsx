"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, CheckCircle2, Clock, Video } from "lucide-react";

type PublicSlot = {
  id: string;
  startIso: string;
  endIso: string;
  labelCet: string;
};

type PublicProposalPayload = {
  activityId: string;
  subject: string;
  companyName: string | null;
  organizerName: string;
  durationMinutes: number;
  status: "pending_client_choice" | "confirmed" | "alternative_requested" | "expired";
  confirmedSlotId: string | null;
  confirmedAt: string | null;
  alternativeNote: string | null;
  teamsJoinUrl: string | null;
  slots: PublicSlot[];
};

function formatLocalSlot(slot: PublicSlot, timeZone: string): { dateLine: string; timeLine: string } {
  const start = new Date(slot.startIso);
  const end = new Date(slot.endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { dateLine: slot.labelCet, timeLine: "" };
  }
  const dateLine = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(start);

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

  return {
    dateLine,
    timeLine: `${timeFmt.format(start)} – ${timeFmt.format(end)} (${timeZone})`,
  };
}

export default function PublicMeetingSlotPickerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const initialSlotParam = searchParams.get("slot");

  const [payload, setPayload] = useState<PublicProposalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [showAlternativeForm, setShowAlternativeForm] = useState(false);
  const [alternativeNote, setAlternativeNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const localTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Copenhagen";
    } catch {
      return "Europe/Copenhagen";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/public/meeting-slots/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | (PublicProposalPayload & { error?: string })
          | null;
        if (!res.ok || !data) {
          throw new Error(data?.error || "Could not load meeting options.");
        }
        if (cancelled) return;
        setPayload(data);
        const preferred =
          (initialSlotParam && data.slots.find((s) => s.id === initialSlotParam)?.id) ||
          data.confirmedSlotId ||
          data.slots[0]?.id ||
          "";
        setSelectedSlotId(preferred);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load meeting options.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, initialSlotParam]);

  async function handleConfirm() {
    if (!selectedSlotId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/meeting-slots/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          slotId: selectedSlotId,
          name: visitorName.trim() || undefined,
          email: visitorEmail.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (PublicProposalPayload & { error?: string })
        | null;
      if (!res.ok || !data) {
        throw new Error(data?.error || "Could not confirm the meeting time.");
      }
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the meeting time.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestAlternative() {
    if (!alternativeNote.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/meeting-slots/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_alternative",
          name: visitorName.trim() || undefined,
          email: visitorEmail.trim() || undefined,
          note: alternativeNote.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (PublicProposalPayload & { error?: string })
        | null;
      if (!res.ok || !data) {
        throw new Error(data?.error || "Could not send your note.");
      }
      setPayload(data);
      setShowAlternativeForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your note.");
    } finally {
      setSubmitting(false);
    }
  }

  const confirmedSlot = useMemo(
    () => payload?.slots.find((s) => s.id === payload.confirmedSlotId) ?? null,
    [payload],
  );

  return (
    <div className="min-h-screen bg-[#f6f5f2] px-4 py-12 text-carbon-blue">
      <div className="mx-auto max-w-lg border border-carbon-blue/12 bg-white shadow-sm">
        <header className="border-b border-carbon-blue/10 bg-carbon-blue px-6 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-upcycle-orange">
            Standard Bio · Meeting Scheduler
          </p>
          <h1 className="mt-1 text-lg font-semibold">
            {loading ? "Loading meeting times…" : payload?.subject || "Meeting"}
          </h1>
          {payload ? (
            <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/75">
              <span>Organised by {payload.organizerName}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {payload.durationMinutes} min Microsoft Teams
              </span>
            </p>
          ) : null}
        </header>

        <div className="p-6">
          {loading ? (
            <p className="text-sm text-carbon-blue/65">Checking proposed times…</p>
          ) : error && !payload ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : payload?.status === "confirmed" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 border border-emerald-700/25 bg-emerald-50/60 p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-carbon-blue">
                    Meeting confirmed
                  </p>
                  {confirmedSlot ? (
                    <>
                      <p className="mt-1 text-sm font-medium text-carbon-blue">
                        {formatLocalSlot(confirmedSlot, localTimeZone).dateLine}
                      </p>
                      <p className="text-xs text-carbon-blue/75">
                        {formatLocalSlot(confirmedSlot, localTimeZone).timeLine}
                      </p>
                    </>
                  ) : null}
                  <p className="mt-2 text-xs text-carbon-blue/70">
                    A Microsoft Teams calendar invitation has been scheduled with{" "}
                    {payload.organizerName}.
                  </p>
                </div>
              </div>

              {payload.teamsJoinUrl ? (
                <a
                  href={payload.teamsJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-xs font-semibold text-white"
                >
                  <Video className="size-4" />
                  Open Microsoft Teams Link
                </a>
              ) : null}
            </div>
          ) : payload?.status === "alternative_requested" ? (
            <div className="border border-carbon-blue/15 bg-carbon-blue/[0.02] p-4">
              <p className="text-sm font-semibold text-carbon-blue">
                Alternative times requested
              </p>
              <p className="mt-1 text-xs text-carbon-blue/70">
                We have notified {payload.organizerName} with your preferred availability:
              </p>
              <p className="mt-2 border-l-2 border-upcycle-orange pl-3 text-xs italic text-carbon-blue/85">
                {payload.alternativeNote}
              </p>
            </div>
          ) : payload ? (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
                    Select a time ({localTimeZone})
                  </span>
                </div>

                <div className="mt-2.5 grid gap-2.5">
                  {payload.slots.map((slot) => {
                    const formatted = formatLocalSlot(slot, localTimeZone);
                    const active = selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          setShowAlternativeForm(false);
                        }}
                        className={`flex w-full items-center justify-between border px-4 py-3 text-left transition-colors ${
                          active
                            ? "border-upcycle-orange bg-upcycle-orange/[0.06]"
                            : "border-carbon-blue/15 bg-white hover:border-carbon-blue/35"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Calendar
                            className={`mt-0.5 size-4 shrink-0 ${
                              active ? "text-upcycle-orange" : "text-carbon-blue/45"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-semibold text-carbon-blue">
                              {formatted.dateLine}
                            </p>
                            <p className="text-xs text-carbon-blue/70">
                              {formatted.timeLine}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold ${
                            active
                              ? "bg-upcycle-orange text-white"
                              : "border border-carbon-blue/15 text-carbon-blue/65"
                          }`}
                        >
                          {active ? "Selected" : "Choose"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
                    Your name (optional)
                  </span>
                  <input
                    type="text"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="Name"
                    className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
                    Your email (optional)
                  </span>
                  <input
                    type="email"
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange"
                  />
                </label>
              </div>

              {error ? <p className="text-xs text-red-700">{error}</p> : null}

              {!showAlternativeForm ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAlternativeForm(true)}
                    className="text-xs font-medium text-carbon-blue/65 underline-offset-2 hover:text-carbon-blue hover:underline"
                  >
                    None of these work — suggest another time
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSlotId || submitting}
                    onClick={() => void handleConfirm()}
                    className="border border-upcycle-orange bg-upcycle-orange px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {submitting ? "Confirming & booking Teams…" : "Confirm Meeting Time"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 border-t border-carbon-blue/10 pt-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
                      When works better for you?
                    </span>
                    <textarea
                      rows={2}
                      value={alternativeNote}
                      onChange={(e) => setAlternativeNote(e.target.value)}
                      placeholder="e.g. Next Thursday morning or Friday after 14:00 CET"
                      className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAlternativeForm(false)}
                      className="border border-carbon-blue/15 px-3 py-1.5 text-xs font-medium text-carbon-blue/70"
                    >
                      Back to slots
                    </button>
                    <button
                      type="button"
                      disabled={!alternativeNote.trim() || submitting}
                      onClick={() => void handleRequestAlternative()}
                      className="border border-carbon-blue bg-carbon-blue px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {submitting ? "Sending…" : "Send preferred times"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
