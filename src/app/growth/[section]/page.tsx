import { notFound } from "next/navigation";
import { GrowthIntelligenceSectionShell } from "@/components/growth-intelligence/growth-intelligence-section-shell";
import { readLiveCompanies, readLivePipelines } from "@/lib/prisma-data";
import { isGrowthSectionId, type GrowthIntelligenceSectionId } from "@/types/growth-intelligence";

const SECTION_PAGES: Exclude<GrowthIntelligenceSectionId, "dashboard">[] = [
  "competitors",
  "events",
  "memberships",
  "market-segments",
  "marketing-channels",
  "partner-ecosystem",
  "recommendations",
  "strategic-initiatives",
  "market-intelligence",
];

type GrowthSectionPageProps = {
  params: Promise<{ section: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return SECTION_PAGES.map((section) => ({ section }));
}

export default async function GrowthSectionPage({ params }: GrowthSectionPageProps) {
  const { section } = await params;

  if (!isGrowthSectionId(section) || section === "dashboard") {
    notFound();
  }

  const [companies, pipelines] = await Promise.all([
    readLiveCompanies(),
    readLivePipelines(),
  ]);

  return (
    <GrowthIntelligenceSectionShell
      section={section}
      companies={companies}
      pipelines={pipelines}
    />
  );
}
