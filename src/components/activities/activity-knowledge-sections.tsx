import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  GitBranch,
  User,
  Workflow,
} from "lucide-react";
import type { Activity } from "@/types/activity";
import { formatDueDate } from "@/lib/activity-utils";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { isFollowUpOverdue } from "@/lib/activity-utils";
import { ACTIVITY_KNOWLEDGE_SECTIONS } from "@/types/activity-knowledge";

export function ActivityKnowledgeSections({ activity }: { activity: Activity }) {
  const memory = buildRelationshipMemory(activity);
  const overdue = isFollowUpOverdue(activity);

  return (
    <div className="flex flex-col gap-4">
      <KnowledgeSectionCard sectionId="what_happened">
        <p className="text-sm leading-relaxed text-carbon-blue/85">{memory.whatHappened}</p>
        {memory.summary !== memory.whatHappened ? (
          <p className="mt-2 text-xs text-carbon-blue/50">{memory.summary}</p>
        ) : null}
      </KnowledgeSectionCard>

      {memory.whatWasAgreed.length > 0 ? (
        <KnowledgeSectionCard sectionId="what_was_agreed">
          <ul className="space-y-2">
            {memory.whatWasAgreed.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-carbon-blue/80">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-upcycle-orange/70" />
                {item}
              </li>
            ))}
          </ul>
        </KnowledgeSectionCard>
      ) : null}

      {memory.whatHappensNext ? (
        <KnowledgeSectionCard
          sectionId="what_happens_next"
          className={`border-l-4 ${overdue ? "border-l-red-500" : "border-l-upcycle-orange"}`}
        >
          <p className="text-sm font-medium text-carbon-blue">{memory.whatHappensNext}</p>
          {memory.whatHappensNextDue ? (
            <p className="mt-1 text-xs text-carbon-blue/50">
              Due {formatDueDate(memory.whatHappensNextDue)}
            </p>
          ) : null}
        </KnowledgeSectionCard>
      ) : null}

      {memory.risks.length > 0 ? (
        <KnowledgeSectionCard sectionId="risks">
          <ul className="space-y-2">
            {memory.risks.map((risk) => (
              <li key={risk} className="flex items-start gap-2 text-sm text-red-700/90">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </KnowledgeSectionCard>
      ) : null}

      {memory.decisions.length > 0 ? (
        <KnowledgeSectionCard sectionId="decisions">
          <ul className="space-y-2">
            {memory.decisions.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-carbon-blue/80">
                <GitBranch className="mt-0.5 size-4 shrink-0 text-upcycle-orange/70" />
                {item}
              </li>
            ))}
          </ul>
        </KnowledgeSectionCard>
      ) : null}

      {memory.commitments.length > 0 ? (
        <KnowledgeSectionCard sectionId="commitments">
          <ul className="space-y-2">
            {memory.commitments.map((action) => (
              <li
                key={action.text}
                className="flex items-start gap-2 text-sm text-carbon-blue/80"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600/70" />
                <span>
                  {action.text}
                  {action.dueDate ? (
                    <span className="ml-1 text-xs text-carbon-blue/45">
                      · Due {formatDueDate(action.dueDate)}
                    </span>
                  ) : null}
                  {action.status ? (
                    <span className="ml-1 text-xs text-carbon-blue/40">· {action.status}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </KnowledgeSectionCard>
      ) : null}

      {memory.stakeholders.length > 0 ? (
        <KnowledgeSectionCard sectionId="stakeholders">
          <ul className="space-y-2">
            {memory.stakeholders.map((stakeholder) => (
              <li
                key={stakeholder.name}
                className="flex items-start justify-between gap-2 text-sm text-carbon-blue/80"
              >
                <span className="flex items-center gap-2">
                  <User className="size-4 shrink-0 text-carbon-blue/40" />
                  {stakeholder.name}
                </span>
                {stakeholder.role ? (
                  <span className="text-xs text-carbon-blue/45">{stakeholder.role}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </KnowledgeSectionCard>
      ) : null}

      {(memory.linkedContacts.length > 0 ||
        memory.linkedDeals.length > 0 ||
        memory.linkedDocuments.length > 0) && (
        <KnowledgeSectionCard sectionId="linked_context">
          <div className="flex flex-wrap gap-2">
            {memory.linkedContacts.map((contact) => (
              <Link
                key={contact.Title}
                href="/contacts"
                className="inline-flex items-center gap-1.5 border border-carbon-blue/10 px-2.5 py-1 text-xs text-carbon-blue/70 hover:border-upcycle-orange/25 hover:text-upcycle-orange"
              >
                <User className="size-3" />
                {contact.Title}
              </Link>
            ))}
            {memory.linkedDeals.map((deal) => (
              <Link
                key={deal.Title}
                href={`/deals/${deal.Title}`}
                className="inline-flex items-center gap-1.5 border border-carbon-blue/10 px-2.5 py-1 font-mono text-[11px] text-upcycle-orange hover:border-upcycle-orange/30"
              >
                <Workflow className="size-3" />
                {deal.Title}
              </Link>
            ))}
            {memory.linkedDocuments.map((doc) => (
              <span
                key={doc.Title}
                className="inline-flex items-center gap-1.5 border border-carbon-blue/10 px-2.5 py-1 text-xs text-carbon-blue/70"
              >
                <FileText className="size-3" />
                {doc.Title}
              </span>
            ))}
          </div>
        </KnowledgeSectionCard>
      )}

      {memory.smartAssistAssessment ? (
        <KnowledgeSectionCard sectionId="smartassist_assessment">
          <div className="flex items-start gap-2">
            <Bot className="mt-0.5 size-4 shrink-0 text-upcycle-orange" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-carbon-blue/80">
                {memory.smartAssistAssessment.summary}
              </p>
              <p className="mt-2 text-xs text-carbon-blue/45">
                Completeness: {memory.smartAssistAssessment.completenessScore}% · Confidence:{" "}
                {memory.smartAssistAssessment.confidence}
              </p>
              {memory.smartAssistAssessment.gaps.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {memory.smartAssistAssessment.gaps.map((gap) => (
                    <li key={gap} className="text-xs text-amber-700/90">
                      Gap: {gap}
                    </li>
                  ))}
                </ul>
              ) : null}
              {memory.smartAssistAssessment.recommendations.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {memory.smartAssistAssessment.recommendations.map((rec) => (
                    <li key={rec} className="text-xs text-carbon-blue/55">
                      → {rec}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </KnowledgeSectionCard>
      ) : null}
    </div>
  );
}

function KnowledgeSectionCard({
  sectionId,
  children,
  className = "",
}: {
  sectionId: (typeof ACTIVITY_KNOWLEDGE_SECTIONS)[number]["id"];
  children: React.ReactNode;
  className?: string;
}) {
  const section = ACTIVITY_KNOWLEDGE_SECTIONS.find((s) => s.id === sectionId);
  const label = section?.label ?? sectionId;

  return (
    <section className={`dashboard-card p-5 ${className}`}>
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        {label}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
