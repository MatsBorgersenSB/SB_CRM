import { NextResponse } from "next/server";
import { readActivities, readCompanies, readPipelines, readSmartDocsLibrary } from "@/lib/pipeline-db";
import { buildUsersAccessAudit } from "@/lib/users-access-engine";
import { readUsers } from "@/lib/users-access-db";

export async function GET() {
  const [users, companies, pipelines, activities, smartDocs] = await Promise.all([
    readUsers(),
    readCompanies(),
    readPipelines(),
    readActivities(),
    readSmartDocsLibrary(),
  ]);

  const audit = buildUsersAccessAudit({ users, companies, pipelines, activities, smartDocs });
  return NextResponse.json(audit);
}
