import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Contact360PageShell } from "@/components/layout/contact-360-page-shell";
import { isNextNotFound, normalizeRouteKey } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveOutlookEvidence,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { resolveContactRouteRecord } from "@/lib/resolve-contact-route";

type Contact360PageProps = {
  params: Promise<{ contactId: string }>;
  searchParams?: Promise<{ company?: string | string[] }>;
};

function readCompanyHint(
  searchParams: { company?: string | string[] } | undefined,
): string | undefined {
  const raw = searchParams?.company;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export default async function Contact360Page({
  params,
  searchParams,
}: Contact360PageProps) {
  const resolvedParams = await params;
  const contactId = normalizeRouteKey(resolvedParams.contactId);

  if (!contactId) {
    notFound();
  }

  try {
    const resolvedSearch = searchParams ? await searchParams : undefined;
    const companyHint = readCompanyHint(resolvedSearch);

    const [
      { companies, pipelines },
      activities,
      commercialPackages,
      outlookEvidence,
      projects,
    ] = await Promise.all([
      readLivePortfolio(),
      readLiveActivities(),
      readLiveCommercialPackages(),
      readLiveOutlookEvidence(),
      readProjects(),
    ]);

    const record = await resolveContactRouteRecord(
      companies,
      pipelines,
      contactId,
      companyHint,
    );

    if (!record) {
      notFound();
    }

    return (
      <Suspense fallback={null}>
        <Contact360PageShell
          contactId={record.contact.ContactID}
          companies={companies}
          pipelines={pipelines}
          activities={activities}
          commercialPackages={commercialPackages}
          outlookEvidence={outlookEvidence}
          projects={projects}
        />
      </Suspense>
    );
  } catch (error) {
    if (isNextNotFound(error)) throw error;
    console.error(
      "[Contact360Page] Contact detail failed:",
      error instanceof Error ? error.message : error,
    );
    notFound();
  }
}
