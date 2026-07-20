"use client";

import type { Contact } from "@/types/contact";
import { normalizeEmploymentStatus } from "@/lib/contact-lifecycle-engine";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  EMPLOYMENT_STATUSES,
  type EmploymentStatus,
} from "@/types/contact-lifecycle";
import type { RelationshipHealthStatus } from "@/lib/relationship-intelligence";
import { HealthStatusIcon } from "@/components/ui/smartcrm-icon";

/**
 * Upper-right status panel — employment, last touch, relationship health (Phase 1.28B).
 */
export function Contact360StatusPanel({
  contact,
  lastInteractionDate,
  healthStatus,
  employmentBusy,
  onEmploymentStatusChange,
  editing = false,
}: {
  contact: Contact;
  lastInteractionDate?: string;
  healthStatus: RelationshipHealthStatus;
  employmentBusy?: boolean;
  onEmploymentStatusChange: (status: EmploymentStatus) => void;
  editing?: boolean;
}) {
  const employmentStatus = normalizeEmploymentStatus(contact);

  return (
    <aside className="w-full shrink-0 border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3 lg:w-[280px] xl:w-[300px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Status
      </p>

      <dl className="mt-3 space-y-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Employment status
          </dt>
          <dd className="mt-1">
            {editing ? (
              <span className="text-[12px] text-carbon-blue/55">Editing in form above</span>
            ) : (
              <select
                value={contact.EmploymentStatus ?? employmentStatus}
                disabled={employmentBusy}
                onChange={(event) =>
                  onEmploymentStatusChange(event.target.value as EmploymentStatus)
                }
                className="w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
              >
                {EMPLOYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Last interaction
          </dt>
          <dd className="mt-1 text-[13px] font-medium text-carbon-blue">
            {lastInteractionDate ? formatRelativeTime(lastInteractionDate) : "Never recorded"}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Relationship health
          </dt>
          <dd className="mt-1">
            <span className="inline-flex items-center gap-1.5 border border-carbon-blue/10 bg-white px-2.5 py-1 text-[12px] font-medium text-carbon-blue">
              <HealthStatusIcon status={healthStatus} />
              {healthStatus}
            </span>
          </dd>
        </div>
      </dl>
    </aside>
  );
}
