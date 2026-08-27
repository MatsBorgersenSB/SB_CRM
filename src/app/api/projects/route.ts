import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  createProject,
  readProjects,
  type CreateProjectInput,
} from "@/lib/project-db";
import { canCreateProject } from "@/lib/permissions";

export async function GET() {
  try {
    const projects = await readProjects();
    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        linkedCompanyId: p.linkedCompanyId ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "List failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = getRequestRole(request);

  if (!canCreateProject(role)) {
    return NextResponse.json(
      { error: `Role "${role}" cannot create projects` },
      { status: 403 },
    );
  }

  const body = (await request.json()) as CreateProjectInput;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  try {
    const project = await createProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
