import { OpportunityDetailWorkspace } from "@/components/opportunity/opportunity-detail-workspace";

type Deal360PageProps = {
  params: Promise<{ id?: string; dealId?: string; opportunityId?: string }>;
};

/**
 * Deal / Opportunity 360 at `/deals/[id]` — same resolver as `/opportunities/[id]`.
 */
export default async function Deal360Page({ params }: Deal360PageProps) {
  return (
    <OpportunityDetailWorkspace
      params={params}
      paramKeys={["dealId", "id", "opportunityId"]}
    />
  );
}
