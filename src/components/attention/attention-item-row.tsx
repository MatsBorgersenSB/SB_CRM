"use client";

import Link from "next/link";
import { resolveAttentionActions } from "@/lib/attention-action-resolver";
import type { AttentionItem, AttentionSeverity } from "@/types/attention-item";
import { ATTENTION_SEVERITY_STYLES } from "@/types/attention-item";
import { ImpactContext } from "@/components/ui/impact-context";
import { AttentionActionButtons } from "@/components/attention/attention-action-buttons";
import {
  ObjectTypeIcon,
  SeverityIcon,
  SmartCRMIcon,
} from "@/components/ui/smartcrm-icon";

export function AttentionItemRow({
  item,
  showSeverity = false,
}: {
  item: AttentionItem;
  showSeverity?: boolean;
}) {
  const actions = resolveAttentionActions(item);

  return (
    <article
      className={`border px-4 py-3 transition-colors hover:border-upcycle-orange/20 ${
        showSeverity ? ATTENTION_SEVERITY_STYLES[item.severity] : "border-carbon-blue/8 bg-white"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showSeverity ? <SeverityIcon severity={item.severity} /> : null}
            <ObjectTypeIcon objectType={item.objectType} />
            <Link href={item.href} className="group min-w-0">
              <p className="truncate text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                {item.sourceObjectName}
              </p>
            </Link>
          </div>

          <p className="mt-1 text-sm font-medium text-carbon-blue">{item.suggestedAiAction}</p>
          <ImpactContext items={[item.recommendation]} />

          {item.companyName && item.objectType !== "Company" ? (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-carbon-blue/40">
              <SmartCRMIcon name="company" size="xs" />
              {item.companyName}
            </p>
          ) : null}

          {item.dueDate ? (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-carbon-blue/40">
              <SmartCRMIcon name="meeting" size="xs" />
              Due {new Date(item.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          <AttentionActionButtons actions={actions} compact />
        </div>
      </div>
    </article>
  );
}

export function AttentionSeverityGroup({
  severity,
  items,
  defaultOpen = true,
}: {
  severity: AttentionSeverity;
  items: AttentionItem[];
  defaultOpen?: boolean;
}) {
  if (items.length === 0) return null;

  const label = {
    urgent: "Urgent",
    needs_attention: "Needs Attention",
    waiting: "Waiting",
    healthy: "Healthy",
    completed: "Completed",
  }[severity];

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
        <SeverityIcon severity={severity} />
        {label}
        <span className="font-normal text-carbon-blue/30">({items.length})</span>
      </h3>
      <ul className={`space-y-2 ${defaultOpen ? "" : "hidden"}`}>
        {items.map((item) => (
          <li key={item.id}>
            <AttentionItemRow item={item} showSeverity />
          </li>
        ))}
      </ul>
    </section>
  );
}
