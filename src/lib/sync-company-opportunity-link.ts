import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { Company } from "@/types/company";
import type { UserRole } from "@/types/auth";

export async function linkCompanyToOpportunity(
  companyId: string,
  pipelineId: string,
  role: UserRole = "superuser",
): Promise<Company> {
  const response = await fetch(
    `/api/companies/${encodeURIComponent(companyId)}/link-opportunity`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [AUTH_ROLE_HEADER]: role,
      },
      body: JSON.stringify({ pipelineId }),
    },
  );

  const body = (await response.json().catch(() => null)) as {
    company?: Company;
    error?: string;
  } | null;

  if (!response.ok || !body?.company) {
    throw new Error(body?.error || `Failed to link opportunity (${response.status})`);
  }

  return body.company;
}
