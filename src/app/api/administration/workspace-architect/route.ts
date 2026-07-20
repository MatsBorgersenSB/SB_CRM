import { NextResponse } from "next/server";
import {
  completeWorkspaceArchitectSession,
} from "@/lib/workspace-architect-engine";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";
import type { WorkspaceArchitectSession } from "@/types/workspace-architect";

async function loadCrmData() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
  ]);
  return { companies, pipelines, activities, commercialPackages };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { session: WorkspaceArchitectSession };
  const crm = await loadCrmData();

  const session = completeWorkspaceArchitectSession(body.session, {
    answers: body.session.answers,
    ...crm,
  });

  return NextResponse.json({ session, design: session.design });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { session: WorkspaceArchitectSession };
  const session: WorkspaceArchitectSession = {
    ...body.session,
    design: body.session.design
      ? { ...body.session.design, approved: true }
      : null,
  };

  return NextResponse.json({ session });
}
