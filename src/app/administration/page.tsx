import { AdministrationShell } from "@/components/administration/administration-shell";
import { readLiveCompanies } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdministrationPage() {
  const companies = await readLiveCompanies();

  return <AdministrationShell companies={companies} />;
}
