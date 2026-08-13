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

  if (existing.contacts.some((row) => row.ContactID === contact.ContactID)) {
    return companies;
  }

  return companies.map((row) =>
    row.CompanyID === existing.CompanyID
      ? { ...row, contacts: [...row.contacts, contact] }
      : row,
  );
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
      />
    </Suspense>
  );
}
