import Link from "next/link";
import { Building2, User } from "lucide-react";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { company360Href } from "@/types/company-360";
import { BusinessImpactBadge } from "@/components/smartdocs/document-intelligence-display";

export function Document360RelationshipsTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { companies, contacts, intelligence } = snapshot;

  return (
    <div className="space-y-4">
      <section className="dashboard-card px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-carbon-blue">Business impact</h2>
          <BusinessImpactBadge level={intelligence.insights.businessImpactLevel} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-carbon-blue/65">
          {intelligence.insights.businessImpact}
        </p>
        <p className="mt-2 text-[11px] text-carbon-blue/45">
          {intelligence.insights.relationshipDependency}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="dashboard-card">
          <header className="flex items-center gap-2 border-b border-carbon-blue/8 px-5 py-3">
            <Building2 className="size-4 text-carbon-blue/40" />
            <h2 className="text-sm font-semibold text-carbon-blue">
              Linked companies ({companies.length})
            </h2>
          </header>
          {companies.length === 0 ? (
            <p className="px-5 py-6 text-xs text-carbon-blue/45">No linked companies.</p>
          ) : (
            <ul className="divide-y divide-carbon-blue/6">
              {companies.map((c) => (
                <li key={c.CompanyID}>
                  <Link
                    href={company360Href(c.CompanyID, "opportunities")}
                    className="block px-5 py-3 text-sm font-medium text-carbon-blue hover:text-upcycle-orange"
                  >
                    {c.Title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card">
          <header className="flex items-center gap-2 border-b border-carbon-blue/8 px-5 py-3">
            <User className="size-4 text-carbon-blue/40" />
            <h2 className="text-sm font-semibold text-carbon-blue">
              Linked contacts ({contacts.length})
            </h2>
          </header>
          {contacts.length === 0 ? (
            <p className="px-5 py-6 text-xs text-carbon-blue/45">No linked contacts.</p>
          ) : (
            <ul className="divide-y divide-carbon-blue/6">
              {contacts.map((c) => (
                <li key={c.contactId} className="px-5 py-3">
                  <p className="text-sm font-medium text-carbon-blue">{c.name}</p>
                  <p className="text-[10px] text-carbon-blue/45">{c.companyName}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
