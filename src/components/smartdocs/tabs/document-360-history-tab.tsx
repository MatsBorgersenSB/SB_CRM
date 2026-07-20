import Link from "next/link";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { formatRelativeTime } from "@/lib/relative-time";
import type { SmartDocTimelineEventKind } from "@/types/smartdoc";

const TIMELINE_KIND_STYLES: Record<SmartDocTimelineEventKind, string> = {
  creation: "bg-violet-500/10 text-violet-700 border-violet-500/25",
  review: "bg-sky-500/10 text-sky-700 border-sky-500/25",
  update: "bg-carbon-blue/8 text-carbon-blue/70 border-carbon-blue/15",
  approval: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  reference: "bg-upcycle-orange/8 text-upcycle-orange border-upcycle-orange/25",
};

export function Document360HistoryTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { intelligence } = snapshot;
  const events = intelligence.timeline;

  return (
    <section className="dashboard-card">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">SmartDocs timeline</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">
          Creation, reviews, updates, approvals, and references
        </p>
      </header>
      {events.length === 0 ? (
        <p className="px-5 py-8 text-sm text-carbon-blue/45">No timeline events recorded.</p>
      ) : (
        <ol className="relative px-5 py-4">
          {events.map((event, index) => (
            <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index < events.length - 1 ? (
                <span className="absolute left-[7px] top-4 h-full w-px bg-carbon-blue/10" />
              ) : null}
              <span
                className={`relative z-10 mt-0.5 size-3.5 shrink-0 rounded-full border-2 border-[var(--dashboard-card)] ${
                  event.kind === "approval"
                    ? "bg-emerald-500"
                    : event.kind === "review"
                      ? "bg-sky-500"
                      : event.kind === "creation"
                        ? "bg-violet-500"
                        : event.kind === "update"
                          ? "bg-carbon-blue/40"
                          : "bg-upcycle-orange"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${TIMELINE_KIND_STYLES[event.kind]}`}
                  >
                    {event.kind}
                  </span>
                  <span className="text-[10px] text-carbon-blue/40">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-carbon-blue">{event.label}</p>
                <p className="mt-0.5 text-[11px] text-carbon-blue/55">{event.detail}</p>
                {event.activityId ? (
                  <Link
                    href={`/activities/${event.activityId}`}
                    className="mt-1 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
                  >
                    View activity →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
