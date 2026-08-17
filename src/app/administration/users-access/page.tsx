import { UsersAccessShell } from "@/components/administration/users-access-shell";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { buildUsersAccessAudit } from "@/lib/users-access-engine";
import { readUsers } from "@/lib/users-access-db";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersAccessPage() {
  const [users, companies, pipelines, activities, smartDocs] = await Promise.all([
    readUsers(),
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveSmartDocsLibrary(),
  ]);

  const audit = buildUsersAccessAudit({ users, companies, pipelines, activities, smartDocs });

  return (
    <WorkspaceChrome>
      <UsersAccessShell initialUsers={users} initialAudit={audit} />
    </WorkspaceChrome>
  );
}
