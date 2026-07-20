import type { CompanyHeroIdentityView } from "@/lib/company-identity";
import { companyWebsiteHref } from "@/lib/company-identity";

type CompanyIdentityOverviewProps = {
  identity: CompanyHeroIdentityView;
};

export function CompanyIdentityOverview({ identity }: CompanyIdentityOverviewProps) {
  const fields = [
    { label: "Company Name", value: identity.companyName },
    { label: "Industry", value: identity.industry },
    { label: "Parent Company", value: identity.parentCompany },
    identity.website
      ? {
          label: "Website",
          value: identity.website,
          href: companyWebsiteHref(identity.website),
        }
      : { label: "Website", value: "—" },
    { label: "Phone", value: identity.mainPhone || "—" },
    { label: "Address", value: identity.address || "—" },
  ];

  return (
    <dl className="grid gap-0 border border-carbon-blue/10">
      {fields.map((field) => (
        <div
          key={field.label}
          className="grid grid-cols-[120px_1fr] border-b border-carbon-blue/10 last:border-b-0"
        >
          <dt className="border-r border-carbon-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {field.label}
          </dt>
          <dd className="px-3 py-2 text-xs text-carbon-blue">
            {"href" in field && field.href ? (
              <a
                href={field.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-upcycle-orange"
              >
                {field.value}
              </a>
            ) : (
              <span className="whitespace-pre-line">{field.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
