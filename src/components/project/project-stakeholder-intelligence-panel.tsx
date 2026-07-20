"use client";

import type { ProjectStakeholderIntelligence } from "@/types/project-relationships";
import { HealthStatusIcon } from "@/components/ui/smartcrm-icon";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import { ProjectRelationshipValidationBanner } from "@/components/project/project-relationship-validation-banner";

const EXECUTION_SECTIONS: Array<{
  key: keyof NonNullable<ProjectStakeholderIntelligence["executionIntelligence"]>;
  label: string;
  items: "owners" | "delivery" | "approvers" | "recipients" | "waiting";
}> = [
  { key: "owners", label: "Who owns what", items: "owners" },
  { key: "delivery", label: "Who delivers what", items: "delivery" },
  { key: "approvers", label: "Who approves what", items: "approvers" },
  { key: "recipients", label: "Who receives what", items: "recipients" },
  { key: "waiting", label: "Who is waiting", items: "waiting" },
];

export function ProjectStakeholderIntelligencePanel({
  intelligence,
  compact = false,
}: {
  intelligence: ProjectStakeholderIntelligence;
  compact?: boolean;
}) {
  const execution = intelligence.executionIntelligence;

  return (
    <div className="flex flex-col gap-6">
      {intelligence.relationshipValidation?.detected ? (
        <ProjectRelationshipValidationBanner
          validation={intelligence.relationshipValidation}
          compact={compact}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Stakeholder coverage
          </p>
          <p className="text-[22px] font-semibold tabular-nums text-carbon-blue">
            {intelligence.coverageScore}
            <span className="text-[13px] font-medium text-carbon-blue/45"> / 100</span>
          </p>
          <p className="text-[12px] text-carbon-blue/55">{intelligence.coverageLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Relationship health
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-carbon-blue">
            <HealthStatusIcon status={intelligence.relationshipHealth} size="xs" />
            {intelligence.relationshipHealth}
          </p>
        </div>
      </div>

      {execution && !compact ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
            Execution intelligence
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {EXECUTION_SECTIONS.map((section) => {
              const items = execution[section.items];
              return (
                <div key={section.key} className="border border-carbon-blue/10 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                    {section.label}
                  </p>
                  {items.length === 0 ? (
                    <p className="mt-2 text-[12px] text-carbon-blue/45">Not assigned yet.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {items.map((entry) => (
                        <li key={entry.id} className="text-[12px]">
                          <span className="font-semibold text-carbon-blue">{entry.name}</span>
                          <span className="text-carbon-blue/45"> · {entry.role}</span>
                          <p className="text-carbon-blue/60">{entry.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {execution && (execution.blocked.length > 0 || execution.missing.length > 0) ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
            Blocked & missing
          </p>
          {execution.blocked.length > 0 ? (
            <div className="mb-3 flex flex-col gap-2">
              {execution.blocked.map((blocker) => (
                <div key={blocker.id} className="border border-carbon-blue/10 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <SmartAssistCategoryBadge
                      category={blocker.severity === "critical" ? "missing_critical" : "assumed"}
                    />
                  </div>
                  <p className="mt-2 text-[13px] font-semibold text-carbon-blue">{blocker.label}</p>
                  <p className="mt-1 text-[12px] text-carbon-blue/55">{blocker.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
          {execution.missing.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[12px] text-carbon-blue/65">
              {execution.missing.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {intelligence.missingRoles.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
            SmartAssist stakeholder gaps
          </p>
          <div className="flex flex-col gap-3">
            {intelligence.missingRoles.map((gap) => (
              <div key={gap.id} className="border border-carbon-blue/10 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <SmartAssistCategoryBadge
                    category={gap.severity === "critical" ? "missing_critical" : "assumed"}
                  />
                  <SmartAssistConfidenceLabel confidence={gap.severity === "critical" ? "high" : "medium"} />
                </div>
                <p className="mt-2 text-[13px] font-semibold text-carbon-blue">{gap.label}</p>
                <p className="mt-1 text-[12px] text-carbon-blue/55">{gap.impact}</p>
                {!compact ? (
                  <p className="mt-1 text-[12px] text-carbon-blue/70">{gap.recommendedAction}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!compact && intelligence.influenceMap.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
            Influence map
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  <th className="px-2 py-2">Stakeholder</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Organization</th>
                  <th className="px-2 py-2">Influence</th>
                </tr>
              </thead>
              <tbody>
                {intelligence.influenceMap.map((node) => (
                  <tr key={node.stakeholderId} className="border-b border-carbon-blue/5">
                    <td className="px-2 py-2.5 font-medium text-carbon-blue">{node.name}</td>
                    <td className="px-2 py-2.5 text-carbon-blue/70">{node.role}</td>
                    <td className="px-2 py-2.5 text-carbon-blue/55">{node.organizationName}</td>
                    <td className="px-2 py-2.5 text-carbon-blue/55">{node.influence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!compact && intelligence.responsibilities.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
            Roles & responsibilities
          </p>
          <ul className="flex flex-col gap-2">
            {intelligence.responsibilities.map((entry) => (
              <li key={entry.stakeholderId} className="border border-carbon-blue/8 px-3 py-2 text-[12px]">
                <span className="font-semibold text-carbon-blue">{entry.name}</span>
                <span className="text-carbon-blue/45"> · {entry.role}</span>
                <p className="mt-1 text-carbon-blue/65">{entry.responsibilities}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
