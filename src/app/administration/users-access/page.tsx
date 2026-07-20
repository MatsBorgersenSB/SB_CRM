import { UsersAccessShell } from "@/components/administration/users-access-shell";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { buildUsersAccessAudit } from "@/lib/users-access-engine";
import { readUsers } from "@/lib/users-access-db";
import { readActivities, readCompanies, readPipelines, readSmartDocsLibrary } from "@/lib/pipeline-db";

export default async function UsersAccessPage() {
  const [users, companies, pipelines, activities, smartDocs] = await Promise.all([
    readUsers(),
    readCompanies(),
    readPipelines(),
    readActivities(),
    readSmartDocsLibrary(),
  ]);

  const audit = buildUsersAccessAudit({ users, companies, pipelines, activities, smartDocs });

  return (
    <WorkspaceChrome>
      <UsersAccessShell initialUsers={users} initialAudit={audit} />
    </WorkspaceChrome>
  );
}
