"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CommercialViabilityAction } from "@/types/commercial-viability";

export function OpportunityNextActions({
  actions,
  limit = 3,
}: {
  actions: CommercialViabilityAction[];
  limit?: number;
}) {
  const top = actions.slice(0, limit);

  if (top.length === 0) {
    return (
      <p className="text-[11px] text-carbon-blue/45">
        No recommended actions — log customer interactions to generate commercial intelligence.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {top.map((action, index) => (
        <li key={`${action.action}-${index}`}>
          <Link
            href={action.href}
            className="group flex items-start gap-3 rounded-lg border border-carbon-blue/10 px-3 py-2.5 transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.03]"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-upcycle-orange/10 text-[10px] font-bold text-upcycle-orange">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                {action.action}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-blue/50">{action.reason}</p>
            </div>
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-carbon-blue/25 group-hover:text-upcycle-orange" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
