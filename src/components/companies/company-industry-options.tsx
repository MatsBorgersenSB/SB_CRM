import { COMPANY_INDUSTRY_GROUPS } from "@/types/company";

/** Grouped `<option>` list for turnkey process-plant industry taxonomy. */
export function CompanyIndustryOptions() {
  return (
    <>
      {COMPANY_INDUSTRY_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
