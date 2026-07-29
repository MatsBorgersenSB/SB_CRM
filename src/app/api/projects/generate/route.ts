import { NextResponse } from "next/server";
import {
  generateProjectFromTemplate,
  listStageGateProjectsForCompany,
  type ExecutionProjectType,
} from "@/lib/execution/project-generator";

type GenerateBody = {
  title?: string;
  projectType?: ExecutionProjectType;
  companyId?: string;
  opportunityId?: string | null;
};

const ALLOWED_TYPES = new Set<ExecutionProjectType>([
  "TURNKEY_PLANT",
  "SINGLE_MACHINERY",
  "INTERNAL_RD",
]);

/**
 * POST /api/projects/generate
 * Body: { title, projectType, companyId, opportunityId? }
 */
export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = body.title?.trim();
  const companyId = body.companyId?.trim();
  const projectType = body.projectType;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  if (!projectType || !ALLOWED_TYPES.has(projectType)) {
    return NextResponse.json(
      {
        error:
          "projectType must be TURNKEY_PLANT | SINGLE_MACHINERY | INTERNAL_RD",
      },
      { status: 400 },
    );
  }

  try {
    const project = await generateProjectFromTemplate({
      title,
      projectType,
      companyId,
      opportunityId: body.opportunityId ?? null,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate project";
    const status =
      message === "Company not found" || message === "Opportunity not found"
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/projects/generate?companyId=...
 * Lists Stage-Gate execution projects for a company.
 */
export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId")?.trim();
  if (!companyId) {
    return NextResponse.json(
      { error: "companyId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const projects = await listStageGateProjectsForCompany(companyId);
    return NextResponse.json({ projects });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
