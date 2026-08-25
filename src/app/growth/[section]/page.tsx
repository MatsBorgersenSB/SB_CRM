import { notFound } from "next/navigation";
import { GrowthIntelligenceSectionShell } from "@/components/growth-intelligence/growth-intelligence-section-shell";
import { readLiveGrowthContext } from "@/lib/prisma-data";
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

  const context = await readLiveGrowthContext();

  return (
    <GrowthIntelligenceSectionShell
      section={section}
      companies={context.companies}
      pipelines={context.pipelines}
      extras={{
        activities: context.activities,
        growthDeals: context.growthDeals,
        correspondence: context.correspondence,
      }}
    />
  );
}
