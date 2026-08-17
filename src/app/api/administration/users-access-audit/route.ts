import { NextResponse } from "next/server";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";
import { buildUsersAccessAudit } from "@/lib/users-access-engine";
import { readUsers } from "@/lib/users-access-db";

export async function GET() {
  const [users, companies, pipelines, activities, smartDocs] = await Promise.all([
    readUsers(),
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveSmartDocsLibrary(),
  ]);

  const audit = buildUsersAccessAudit({ users, companies, pipelines, activities, smartDocs });
  return NextResponse.json(audit);
}
