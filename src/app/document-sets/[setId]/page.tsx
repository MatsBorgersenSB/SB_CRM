import { DocumentSet360PageShell } from "@/components/layout/document-set-360-page-shell";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
  readSmartDocsLibrary,
} from "@/lib/pipeline-db";

type PageProps = {
  params: Promise<{ setId: string }>;
};

export default async function DocumentSet360Page({ params }: PageProps) {
  const { setId } = await params;
  const [pipelines, companies, activities, library, commercialPackages] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
    readSmartDocsLibrary(),
    readCommercialPackages(),
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
