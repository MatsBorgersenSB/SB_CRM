"use client";

import { Bot } from "lucide-react";
import type { OpportunityDecisionBrief } from "@/lib/opportunity-overview-engine";

const QUESTIONS = [
  { key: "happening" as const, label: "What is happening?" },
  { key: "shouldDo" as const, label: "What should I do?" },
  { key: "blocking" as const, label: "What is blocking progress?" },
  { key: "forgetting" as const, label: "What am I forgetting?" },
];

export function OpportunitySmartAssistBrief({
  dealName,
  brief,
}: {
  dealName: string;
  brief: OpportunityDecisionBrief;
}) {
  return (
    <section className="dashboard-card border-l-4 border-l-upcycle-orange p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-upcycle-orange/10 text-upcycle-orange">
          <Bot className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
            SmartAssist Opportunity Brief · {dealName}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {QUESTIONS.map((question) => (
              <div key={question.key} className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-carbon-blue/35">
                  {question.label}
                </p>
                {question.key === "forgetting" ? (
                  <ul className="mt-1 space-y-0.5">
                    {brief.forgetting.map((item) => (
                      <li
                        key={item}
                        className="text-[11px] leading-snug text-carbon-blue/70"
                      >
                        · {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] font-medium leading-snug text-carbon-blue">
                    {brief[question.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
