"use client";

import { ContactCareerTimeline } from "@/components/contacts/contact-career-timeline";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import type { CareerHistoryEntry, CompanyTransferRecord } from "@/types/contact-lifecycle";
import type { Activity } from "@/types/activity";
import type { Contact } from "@/types/contact";

function formatDate(value: string | null): string {
  if (!value) return "Present";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Read-only relationship history — no editing (Phase 1.31).
 */
export function ContactHistoryPanel({
  contact,
  careerEntries,
  transfers,
  activities,
  showCareerTimeline,
}: {
  contact: Contact;
  careerEntries: CareerHistoryEntry[];
  transfers: CompanyTransferRecord[];
  activities: Activity[];
  showCareerTimeline: boolean;
}) {
  const employmentChanges = [...(contact.CareerHistory ?? careerEntries)].filter(
    (entry) => entry.endDate !== null,
  );

  return (
    <div className="flex flex-col gap-6">
      {showCareerTimeline ? (
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Timeline
          </h3>
          <ContactCareerTimeline entries={careerEntries} transfers={transfers} />
        </section>
      ) : (
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Timeline
          </h3>
          <p className="text-xs text-carbon-blue/50">
            Single role at current company — no career timeline to display.
          </p>
        </section>
      )}

      {transfers.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Career changes
          </h3>
          <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
            {transfers.map((transfer) => (
              <li key={transfer.id} className="px-3 py-2.5 text-[12px] text-carbon-blue/70">
                <span className="font-medium text-carbon-blue">
                  {transfer.previousCompanyName}
                </span>
                <span className="mx-1 text-carbon-blue/30">→</span>
                <span className="font-medium text-carbon-blue">{transfer.newCompanyName}</span>
                <span className="mt-0.5 block text-[11px] text-carbon-blue/50">
                  {formatDate(transfer.transferDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Activity history
        </h3>
        <ActivityTimeline
          activities={activities}
          compact
          showRail={false}
          emptyMessage="No activities recorded for this contact."
        />
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Employment changes
        </h3>
        {employmentChanges.length > 0 ? (
          <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
            {employmentChanges.map((entry) => (
              <li key={entry.id} className="px-3 py-2.5 text-[12px] text-carbon-blue/70">
                <span className="font-medium text-carbon-blue">
                  {entry.jobTitle || entry.role}
                </span>
                <span className="mx-1 text-carbon-blue/30">·</span>
                <span>{entry.companyName}</span>
                <span className="mt-0.5 block text-[11px] text-carbon-blue/50">
                  {formatDate(entry.startDate)} — {formatDate(entry.endDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-carbon-blue/50">
            No closed employment records — current status:{" "}
            <span className="font-medium text-carbon-blue">
              {contact.EmploymentStatus ?? "Active"}
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
