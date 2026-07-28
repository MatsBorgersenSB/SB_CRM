import { OpportunityDetailWorkspace } from "@/components/opportunity/opportunity-detail-workspace";

type OpportunityDetailPageProps = {
  params: Promise<{ id?: string; dealId?: string; opportunityId?: string }>;
};

/**
 * FS-012 — Opportunity Workspace at `/opportunities/[id]`.
 * Prisma lookup → portfolio/seed (PL-…) → notFound().
 */
export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailPageProps) {
  return (
    <OpportunityDetailWorkspace
      params={params}
      paramKeys={["id", "dealId", "opportunityId"]}
    />
  );
}
