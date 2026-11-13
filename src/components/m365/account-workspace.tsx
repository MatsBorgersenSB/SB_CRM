import Link from "next/link";
import type {
  M365AccountCommitmentItem,
  M365AccountLinkedItem,
  M365AccountPerson,
  M365AccountWorkspacePayload,
  M365RiskBlock,
} from "@/types/m365";
import { ImpactContext } from "@/components/m365/impact-context";
import { NextBestActionCard } from "@/components/m365/next-best-action-card";
import { HealthRing } from "@/components/m365/health-ring";

function BlockLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/60">
      {children}
    </h3>
  );
}

function TopRiskPanel({ risk }: { risk: M365RiskBlock | null }) {
  if (!risk) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <BlockLabel>Top risk</BlockLabel>
        <p className="mt-2 text-[12px] text-carbon-blue/65">No critical account risks</p>
      </section>
    );
  }

  return (
    <section className="border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-4 py-3">
      <BlockLabel>Top risk</BlockLabel>
      <p className="mt-2 text-sm font-medium text-carbon-blue">{risk.label}</p>
      {risk.detail ? (
        <p className="mt-0.5 text-[12px] text-carbon-blue/50">{risk.detail}</p>
      ) : null}
      <ImpactContext items={risk.impact} />
    </section>
  );
}

function CommitmentList({ items }: { items: M365AccountCommitmentItem[] }) {
  if (items.length === 0) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <BlockLabel>Open commitments</BlockLabel>
        <p className="mt-2 text-[12px] text-carbon-blue/65">No open commitments</p>
      </section>
    );
  }

  return (
    <section>
      <BlockLabel>Open commitments</BlockLabel>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`border px-3 py-2.5 ${
              item.overdue
                ? "border-red-200/60 bg-red-50/40"
                : "border-carbon-blue/8"
            }`}
          >
            <Link
              href={item.href}
              className="text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
            >
              {item.title}
            </Link>
            <p className="mt-0.5 text-[11px] text-carbon-blue/60">{item.dueLabel}</p>
            <ImpactContext items={item.impact} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkedList({ items }: { items: M365AccountLinkedItem[] }) {
  const title =
    items.length > 0 && items.every((item) => item.kind === "project")
      ? "Linked projects"
      : items.length > 0 && items.every((item) => item.kind === "opportunity")
        ? "Open opportunities"
        : "Linked work";

  if (items.length === 0) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <BlockLabel>Linked work</BlockLabel>
        <p className="mt-2 text-[12px] text-carbon-blue/65">
          No linked opportunities or projects yet
        </p>
      </section>
    );
  }

  return (
    <section>
      <BlockLabel>{title}</BlockLabel>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="border border-carbon-blue/8 px-3 py-2.5">
            <Link
              href={item.href}
              className="text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
            >
              {item.label}
            </Link>
            <p className="mt-0.5 text-[11px] text-carbon-blue/60">{item.detail}</p>
            <ImpactContext items={item.impact} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PeopleList({ people }: { people: M365AccountPerson[] }) {
  if (people.length === 0) {
    return (
      <section className="border border-carbon-blue/8 px-4 py-3">
        <BlockLabel>People who matter</BlockLabel>
        <p className="mt-2 text-[12px] text-carbon-blue/65">
          No people captured yet — add contacts when you meet them
        </p>
      </section>
    );
  }

  return (
    <section>
      <BlockLabel>People who matter</BlockLabel>
      <ul className="mt-2 space-y-2">
        {people.map((person) => (
          <li key={person.id} className="border border-carbon-blue/8 px-3 py-2.5">
            <Link
              href={person.href}
              className="text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
            >
              {person.name}
            </Link>
            <p className="mt-0.5 text-[11px] text-carbon-blue/60">{person.roleLabel}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Teams Account Workspace — FS-018 fixed 7 blocks, one screen. */
export function AccountWorkspace({
  payload,
  variant = "default",
}: {
  payload: M365AccountWorkspacePayload;
  variant?: "default" | "teams";
}) {
  const shell =
    variant === "teams" ? "min-h-[100dvh] bg-white" : "dashboard-card overflow-hidden";

  return (
    <article className={shell}>
      <div className="space-y-4 px-5 py-5">
        {variant === "teams" ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM · Account Workspace
          </p>
        ) : null}

        {/* 1. What am I looking at? */}
        <section aria-label="What am I looking at">
          <div className="flex items-start gap-3">
            <HealthRing health={payload.health} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-carbon-blue">{payload.companyName}</p>
              <p className="mt-0.5 text-[12px] text-carbon-blue/65">
                {payload.relationshipRoleLabel}
                {payload.lastContactLabel ? ` · ${payload.lastContactLabel}` : ""}
              </p>
              <a
                href={payload.deepLink}
                className="mt-2 inline-flex text-[11px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
              >
                Open in SmartCRM
              </a>
            </div>
          </div>
        </section>

        {/* 2. What changed */}
        <section aria-label="What changed">
          <BlockLabel>What changed</BlockLabel>
          {payload.whatChanged.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {payload.whatChanged.map((line) => (
                <li key={line} className="text-[13px] leading-relaxed text-carbon-blue/65">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-carbon-blue/65">Nothing material in the last 7 days</p>
          )}
        </section>

        {/* 3. Top risk */}
        <TopRiskPanel risk={payload.topRisk} />

        {/* 4. Next best action */}
        <NextBestActionCard action={payload.nextBestAction} compact />

        {/* 5. Open commitments */}
        <CommitmentList items={payload.openCommitments} />

        {/* 6. Linked opportunities / projects */}
        <LinkedList items={payload.linkedItems} />

        {/* 7. People who matter */}
        <PeopleList people={payload.peopleWhoMatter} />
      </div>
    </article>
  );
}
