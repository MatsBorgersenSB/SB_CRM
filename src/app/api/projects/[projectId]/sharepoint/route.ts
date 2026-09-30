import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { provisionProjectSharePointFolder } from "@/lib/m365/provision-project-folder";
import { canUploadSmartDocs } from "@/lib/permissions";
import { resolveCompanyForSmartDocs } from "@/lib/pipeline-db";
import { readProjectById } from "@/lib/project-db";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

async function resolveProjectDocumentsFolder(projectId: string) {
  const project = await readProjectById(projectId);
  if (!project) return null;

  let companyName: string | undefined;
  if (project.linkedCompanyId?.trim()) {
    const company = await resolveCompanyForSmartDocs(project.linkedCompanyId).catch(
      () => undefined,
    );
    companyName = company?.Title;
  }

  const folder = await provisionProjectSharePointFolder(project.name, companyName);
  return { project, companyName, folder };
}

function folderResponse(
  project: { id: string; name: string },
  folder: { folderId: string; webUrl: string; path: string },
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({
    ...extra,
    projectId: project.id,
    projectName: project.name,
    sharepointFolderId: folder.folderId,
    sharepointFolderUrl: folder.webUrl,
    sharepointFolderPath: folder.path,
  });
}

/**
 * Resolve (and create if missing) the project folder in SharePoint.
 * Path SoT: /Projects/{Name} or /Projects/{Company}/{Name}
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  try {
    const resolved = await resolveProjectDocumentsFolder(projectId);
    if (!resolved) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return folderResponse(resolved.project, resolved.folder);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden(
        "You cannot create the SharePoint folder for this project",
      ),
    );
  }

  try {
    const resolved = await resolveProjectDocumentsFolder(projectId);
    if (!resolved) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return folderResponse(resolved.project, resolved.folder, { created: true });
  } catch (error) {
    console.error("[api/projects/sharepoint] provision failed", error);
    return sharePointErrorResponse(error);
  }
}
