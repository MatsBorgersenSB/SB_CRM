import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Contact360PageShell } from "@/components/layout/contact-360-page-shell";
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

function isNextNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).includes("NEXT_HTTP_ERROR")
  );
}

/**
 * Contact 360 — resolves by ContactID, Prisma id, email, or M365 external id.
 * Missing records call notFound() (404) instead of throwing a 500.
 */
export default async function Contact360Page({
  params,
  searchParams,
}: Contact360PageProps) {
  const { contactId: rawContactId } = await params;
  const contactId = decodeURIComponent(rawContactId ?? "").trim();

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

    // prisma.contact.findFirst OR id / email (via helper) + portfolio CT-… match
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
