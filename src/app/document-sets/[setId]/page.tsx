import { DocumentSet360PageShell } from "@/components/layout/document-set-360-page-shell";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveCompanies,
  readLivePipelines,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ setId: string }>;
};

export default async function DocumentSet360Page({ params }: PageProps) {
  const { setId } = await params;
  const [pipelines, companies, activities, library, commercialPackages] = await Promise.all([
    readLivePipelines(),
    readLiveCompanies(),
    readLiveActivities(),
    readLiveSmartDocsLibrary(),
    readLiveCommercialPackages(),
  ]);

  return (
    <DocumentSet360PageShell
      setId={decodeURIComponent(setId)}
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      library={library}
      commercialPackages={commercialPackages}
    />
  );
}
