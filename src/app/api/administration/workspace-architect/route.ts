import { NextResponse } from "next/server";
import {
  completeWorkspaceArchitectSession,
} from "@/lib/workspace-architect-engine";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";
import type { WorkspaceArchitectSession } from "@/types/workspace-architect";

async function loadCrmData() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveCommercialPackages(),
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
