import { notFound } from "next/navigation";
import { CompanyMasterDataShell } from "@/components/administration/company-master-data-shell";
import { readCompanies } from "@/lib/pipeline-db";

type CompanyMasterDataPageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyMasterDataPage({ params }: CompanyMasterDataPageProps) {
  const { companyId } = await params;
  const companies = await readCompanies();

  const company = companies.find(
    (record) => record.CompanyID === companyId || String(record.id) === companyId,
  );

  if (!company) {
    notFound();
  }

  return <CompanyMasterDataShell company={company} companies={companies} />;
}
