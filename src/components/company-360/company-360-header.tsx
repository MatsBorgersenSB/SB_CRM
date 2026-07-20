import Link from "next/link";
import { ArrowLeft, Building2, MapPin, User } from "lucide-react";
import type { Company360Header } from "@/lib/company-360-data";
import {
  RelationshipHealthBadge,
  RelationshipHealthScoreRing,
  RelationshipTrendBadge,
} from "@/components/relationship/relationship-health-display";

type Company360HeaderProps = {
  header: Company360Header;
};

export function Company360Header({ header }: Company360HeaderProps) {
  return (
    <header className="dashboard-card overflow-hidden">
      <div className="border-b border-carbon-blue/8 px-6 py-4">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Companies
        </Link>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center border border-carbon-blue/10 bg-carbon-blue/[0.03]">
              <Building2 className="size-4 text-carbon-blue/50" strokeWidth={1.75} />
            </span>
            <RelationshipHealthBadge status={header.healthStatus} />
            <RelationshipTrendBadge trend={header.trend} />
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-carbon-blue sm:text-3xl">
            {header.companyName}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-carbon-blue/45">
            {header.location !== "—" ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {header.location}
              </span>
            ) : null}
            {header.accountOwner ? (
              <span className="inline-flex items-center gap-1">
                <User className="size-3" />
                {header.accountOwner}
              </span>
            ) : null}
          </div>
        </div>

        <RelationshipHealthScoreRing
          score={header.healthScore}
          status={header.healthStatus}
          size="lg"
        />
      </div>
    </header>
  );
}
