import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { provisionCompanyDocumentsSharePointFolder } from "@/lib/m365/provision-company-folder";
import { canUploadSmartDocs } from "@/lib/permissions";
import { resolveCompanyForSmartDocs } from "@/lib/pipeline-db";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

async function resolveCompanyDocumentsFolder(companyId: string) {
  const company = await resolveCompanyForSmartDocs(companyId);
  if (!company) return null;
  const folder = await provisionCompanyDocumentsSharePointFolder(company.Title);
  return { company, folder };
}

function folderResponse(
  company: { CompanyID: string; Title: string },
  folder: { folderId: string; webUrl: string; path: string },
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({
    ...extra,
    companyId: company.CompanyID,
    companyName: company.Title,
    sharepointFolderId: folder.folderId,
    sharepointFolderUrl: folder.webUrl,
    sharepointFolderPath: folder.path,
  });
}

/**
 * Resolve (and create if missing) the company Documents folder in SharePoint.
 * Path SoT: /Companies/{CompanyName}/Documents
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  try {
    const resolved = await resolveCompanyDocumentsFolder(companyId);
    if (!resolved) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return folderResponse(resolved.company, resolved.folder);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden(
        "You cannot create the SharePoint folder for this company",
      ),
    );
  }

  try {
    const resolved = await resolveCompanyDocumentsFolder(companyId);
    if (!resolved) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return folderResponse(resolved.company, resolved.folder, { created: true });
  } catch (error) {
    console.error("[api/companies/sharepoint] provision failed", error);
    return sharePointErrorResponse(error);
  }
}
