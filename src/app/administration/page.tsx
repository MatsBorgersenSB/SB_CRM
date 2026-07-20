import { AdministrationShell } from "@/components/administration/administration-shell";
import { readCompanies } from "@/lib/pipeline-db";

export default async function AdministrationPage() {
  const companies = await readCompanies();

  return <AdministrationShell companies={companies} />;
}
