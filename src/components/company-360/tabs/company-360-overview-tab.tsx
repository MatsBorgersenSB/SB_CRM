import type { Company360Snapshot } from "@/lib/company-360-data";
import { buildCompanyHeroIdentity } from "@/lib/company-identity";
import { formatRelativeTime } from "@/lib/relative-time";
import { company360Href } from "@/types/company-360";
import { CompanyIdentityOverview } from "@/components/companies/company-identity-overview";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import Link from "next/link";

/** Overview — living record detail on demand. */
export function Company360OverviewTab({ snapshot }: { snapshot: Company360Snapshot }) {
  const { company, activities } = snapshot;
  const identity = buildCompanyHeroIdentity(company);
  const recentActivity = activities.slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection
        title="Company master data"
        description="Full SharePoint record — expand when you need it"
        tier="expert"
      >
        <CompanyIdentityOverview identity={identity} />
      </CollapsibleSection>

      {recentActivity.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-carbon-blue/45">
          No recent activity — check People or Pipeline for next steps.
        </p>
      ) : (
        <CollapsibleSection
          title="Recent activity"
          description={`${recentActivity.length} latest touchpoint${recentActivity.length === 1 ? "" : "s"}`}
          tier="nice-to-have"
        >
          <ul className="space-y-2">
            {recentActivity.map((activity) => (
              <li key={activity.ActivityID}>
                <Link
                  href={`/activities/${activity.ActivityID}`}
                  className="block text-sm text-carbon-blue/70 hover:text-upcycle-orange"
                >
                  <span className="font-medium text-carbon-blue">{activity.Subject}</span>
                  <span className="text-carbon-blue/40">
                    {" "}
                    · {formatRelativeTime(activity.ActivityDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={company360Href(company.CompanyID, "contacts")}
            className="mt-3 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
          >
            All contacts →
          </Link>
        </CollapsibleSection>
      )}
    </div>
  );
}
