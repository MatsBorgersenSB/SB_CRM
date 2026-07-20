"use client";

import type { ProjectOpenWork } from "@/types/project";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

export function ProjectOpenWorkPanel({ openWork }: { openWork: ProjectOpenWork }) {
  const sections = [
    {
      title: "Open Activities",
      items: openWork.openActivities.map((item) => ({
        id: item.id,
        label: item.subject,
        detail: item.status,
      })),
    },
    {
      title: "Blocked Activities",
      items: openWork.blockedActivities.map((item) => ({
        id: item.id,
        label: item.subject,
        detail: item.status,
      })),
    },
    {
      title: "Open Risks",
      items: openWork.openRisks.map((item) => ({
        id: item.id,
        label: item.risk,
        detail: item.severity,
      })),
    },
    {
      title: "Open Issues",
      items: openWork.openIssues.map((item) => ({
        id: item.id,
        label: item.label,
        detail: item.detail,
      })),
    },
  ].filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return (
      <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
        <p className={EDITORIAL_LABEL}>Current state</p>
        <p className="mt-2 text-[14px] text-carbon-blue">No open issues</p>
        <p className="mt-1 text-[14px] text-carbon-blue">No open risks</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.title}>
          <p className={EDITORIAL_LABEL}>{section.title}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {section.items.map((item) => (
              <li key={item.id} className="border border-carbon-blue/10 px-3 py-2.5">
                <p className="text-[13px] font-medium text-carbon-blue">{item.label}</p>
                {item.detail ? (
                  <p className={`mt-1 ${EDITORIAL_BODY_MUTED}`}>{item.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
