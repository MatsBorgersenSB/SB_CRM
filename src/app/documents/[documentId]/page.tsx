import { Document360PageShell } from "@/components/layout/document-360-page-shell";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
  readSmartDocsLibrary,
} from "@/lib/pipeline-db";

type PageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function Document360Page({ params }: PageProps) {
  const { documentId } = await params;
  const [pipelines, companies, activities, library, commercialPackages] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
    readSmartDocsLibrary(),
    readCommercialPackages(),
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
