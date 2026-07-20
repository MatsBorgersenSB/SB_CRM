import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { readProjectById, updateProject, type ProjectPatch } from "@/lib/project-db";
import {
  canAssignProjectOwner,
  canManageProjectStakeholders,
} from "@/lib/permissions";

type UpdateProjectBody = ProjectPatch;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = await readProjectById(projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const role = getRequestRole(request);
  const body = (await request.json()) as UpdateProjectBody;

  if (body.owner !== undefined && !canAssignProjectOwner(role)) {
    return NextResponse.json(
      { error: `Role "${role}" cannot reassign project owner` },
      { status: 403 },
    );
  }

  if (
    (body.projectStakeholders !== undefined ||
      body.relatedOrganizations !== undefined ||
      body.team !== undefined ||
      body.removedStakeholders !== undefined) &&
    !canManageProjectStakeholders(role)
  ) {
    return NextResponse.json(
      { error: `Role "${role}" cannot update project relationships` },
      { status: 403 },
    );
  }

  if (
    body.owner === undefined &&
    body.team === undefined &&
    body.projectStakeholders === undefined &&
    body.relatedOrganizations === undefined &&
    body.removedStakeholders === undefined &&
    body.linkedCompanyId === undefined
  ) {
    return NextResponse.json({ error: "No project updates provided" }, { status: 400 });
  }

  try {
    const updated = await updateProject(projectId, body);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
