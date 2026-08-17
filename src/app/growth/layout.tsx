import { GrowthIntelligenceChrome } from "@/components/growth-intelligence/growth-intelligence-chrome";
import { readLiveCompanies } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GrowthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companies = await readLiveCompanies();

  return <GrowthIntelligenceChrome companies={companies}>{children}</GrowthIntelligenceChrome>;
}
