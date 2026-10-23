import { requireAdminRole } from "@/lib/security/require-admin";
import { NextResponse } from "next/server";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";
import { buildUsersAccessAudit } from "@/lib/users-access-engine";
import { readUsers } from "@/lib/users-access-db";

export async function GET(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;

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
