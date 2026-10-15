import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Contact360PageShell } from "@/components/layout/contact-360-page-shell";
import { pickEntityRouteParam } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveOutlookEvidence,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { resolveContactRouteRecord } from "@/lib/resolve-contact-route";
import { loadCorrespondenceEvidenceForCompany } from "@/lib/company-correspondence-data";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";
import type { EntityRouteParams } from "@/lib/resolvers/entity-resolver";
import type { Company } from "@/types/company";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Contact360PageProps = {
  params: Promise<EntityRouteParams>;
  searchParams?: Promise<{ company?: string | string[] }>;
};

function readCompanyHint(
  searchParams: { company?: string | string[] } | undefined,
): string | undefined {
  const raw = searchParams?.company;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function mergeCompanyIntoPortfolio(
  companies: Company[],
  recordCompanyId: string,
  recordCompanyName: string,
  contact: Company["contacts"][number],
): Company[] {
  const existing = companies.find(
    (row) =>
      row.CompanyID === recordCompanyId ||
      row.code === recordCompanyId ||
      row.Title === recordCompanyName,
  );
  if (!existing) {
    return [
      ...companies,
      {
        id: 0,
        Title: recordCompanyName,
        CompanyID: recordCompanyId,
        code: recordCompanyId,
        ParentCompany: null,
        Domain: "",
        Industry: "Other",
        CompanyTypes: [],
        Status: "Active",
        AccountOwner: null,
        Phone: "",
        Email: "",
        AddressLine1: "",
        AddressLine2: "",
        PostalCode: "",
        City: "",
        Country: null,
        pipelineIds: [],
        contacts: [contact],
      } as Company,
    ];
  }

  return companies.map((row) => {
    if (row.CompanyID !== existing.CompanyID) return row;
    const already = row.contacts.some((entry) => entry.ContactID === contact.ContactID);
    return {
      ...row,
      contacts: already
        ? row.contacts.map((entry) =>
            entry.ContactID === contact.ContactID ? contact : entry,
          )
        : [...row.contacts, contact],
    };
  });
}

export default async function Contact360Page({
  params,
  searchParams,
}: Contact360PageProps) {
  const resolvedParams = await params;
  const rawKey = pickEntityRouteParam(resolvedParams, ["contactId", "id"]);

  if (!rawKey) {
    notFound();
  }

  const resolvedSearch = searchParams ? await searchParams : undefined;
  const companyHint = readCompanyHint(resolvedSearch);

  const [
    { companies, pipelines },
    activities,
    commercialPackages,
    outlookEvidence,
    projects,
    assignableUsers,
  ] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveCommercialPackages(),
    readLiveOutlookEvidence(),
    readProjects(),
    readAssignableStandardBioUsers().catch(() => []),
  ]);

  const record = await resolveContactRouteRecord(
    companies,
    pipelines,
    rawKey,
    companyHint,
  );

  if (!record) {
    notFound();
  }

  const shellCompanies = mergeCompanyIntoPortfolio(
    companies,
    record.companyId,
    record.companyName,
    record.contact,
  );
  const recordCompany = shellCompanies.find(
    (row) =>
      row.CompanyID === record.companyId ||
      row.code === record.companyId ||
      row.Title === record.companyName,
  );
  const correspondence = recordCompany
    ? await loadCorrespondenceEvidenceForCompany(recordCompany)
    : undefined;

  return (
    <Suspense fallback={null}>
      <Contact360PageShell
        contactId={record.contact.ContactID}
        companies={shellCompanies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
        outlookEvidence={outlookEvidence}
        projects={projects}
        correspondence={correspondence}
        assignableUsers={assignableUsers}
      />
    </Suspense>
  );
}
