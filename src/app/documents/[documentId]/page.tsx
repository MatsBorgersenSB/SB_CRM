import { Document360PageShell } from "@/components/layout/document-360-page-shell";
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
  params: Promise<{ documentId: string }>;
};

export default async function Document360Page({ params }: PageProps) {
  const { documentId } = await params;
  const [pipelines, companies, activities, library, commercialPackages] = await Promise.all([
    readLivePipelines(),
    readLiveCompanies(),
    readLiveActivities(),
    readLiveSmartDocsLibrary(),
    readLiveCommercialPackages(),
  ]);

  return (
    <Document360PageShell
      documentId={decodeURIComponent(documentId)}
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      library={library}
      commercialPackages={commercialPackages}
    />
  );
}
