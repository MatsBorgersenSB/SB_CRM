import { NextResponse } from "next/server";
import { getRegistryContactById } from "@/lib/contact-registry";
import {
  mergeComposeRecipientOptions,
  type ComposeRecipientOption,
} from "@/lib/email-compose-recipients";
import { isExternalEmail } from "@/lib/domain-rules";
import { readProjectById } from "@/lib/project-db";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";
import { findCompanyByProjectRef } from "@/lib/project-stakeholder-contacts";
import { readLiveCompanies } from "@/lib/prisma-data";
import { getContactDisplayName } from "@/types/contact";
import { INTERNAL_ORGANIZATION_ID } from "@/types/project-relationships";

/**
 * GET /api/projects/[projectId]/mail-recipients
 * External people to address when opening a project-tagged Outlook draft.
 * Reality First — only stakeholders / company contacts already on the project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = await readProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const rows: ComposeRecipientOption[] = [];
  const stakeholders = getProjectStakeholders(project);

  for (const stakeholder of stakeholders) {
    if (stakeholder.organizationId === INTERNAL_ORGANIZATION_ID) continue;
    if (stakeholder.userId != null && !stakeholder.contactId) continue;
    if (!stakeholder.contactId) continue;

    const contact = await getRegistryContactById(stakeholder.contactId);
    const email = contact?.Email?.trim().toLowerCase() ?? "";
    if (!email || !isExternalEmail(email)) continue;

    rows.push({
      email,
      label: (contact ? getContactDisplayName(contact) : "") || stakeholder.name || email,
      source: "stakeholder",
      isExternal: true,
    });
  }

  try {
    const companies = await readLiveCompanies();
    const organizations = getProjectRelatedOrganizations(project);
    const companyIds = new Set<string>();
    for (const org of organizations) {
      if (org.organizationType === "internal") continue;
      const matched = findCompanyByProjectRef(companies, org.companyId);
      if (matched) companyIds.add(matched.CompanyID);
    }
    if (project.linkedCompanyId) {
      const matched = findCompanyByProjectRef(companies, project.linkedCompanyId);
      if (matched) companyIds.add(matched.CompanyID);
    }

    for (const company of companies) {
      if (!companyIds.has(company.CompanyID)) continue;
      for (const contact of company.contacts ?? []) {
        const email = contact.Email?.trim().toLowerCase() ?? "";
        if (!email || !isExternalEmail(email)) continue;
        rows.push({
          email,
          label: getContactDisplayName(contact) || email,
          source: "company",
          isExternal: true,
        });
      }
    }
  } catch {
    // Stakeholder emails alone are enough when portfolio load fails.
  }

  return NextResponse.json({
    recipients: mergeComposeRecipientOptions(rows),
  });
}
