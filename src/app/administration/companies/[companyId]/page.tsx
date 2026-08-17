import { notFound } from "next/navigation";
import { CompanyMasterDataShell } from "@/components/administration/company-master-data-shell";
import { getCompanyById } from "@/lib/data/companies";
import { readLiveCompanies } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CompanyMasterDataPageProps = {
  params: Promise<{ companyId: string; id?: string }>;
};

export default async function CompanyMasterDataPage({
  params,
}: CompanyMasterDataPageProps) {
  const resolved = await params;
  const rawId = resolved.companyId ?? resolved.id ?? "";
  let cleanId = "";
  try {
    cleanId = decodeURIComponent(String(rawId).split("?")[0] ?? "").trim();
  } catch {
    cleanId = String(rawId).trim();
  }

  if (!cleanId) {
    notFound();
  }

  const companies = await readLiveCompanies();
  const company = await getCompanyById(cleanId, companies);

  if (!company) {
    notFound();
  }

  return <CompanyMasterDataShell company={company} companies={companies} />;
}
