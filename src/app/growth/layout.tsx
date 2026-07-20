import { GrowthIntelligenceChrome } from "@/components/growth-intelligence/growth-intelligence-chrome";
import { readCompanies } from "@/lib/pipeline-db";

export default async function GrowthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companies = await readCompanies();

  return <GrowthIntelligenceChrome companies={companies}>{children}</GrowthIntelligenceChrome>;
}
