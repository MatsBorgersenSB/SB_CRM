import { WorkflowApprovalWorkspace } from "@/components/workflows/workflow-approval-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { readWorkflowApprovalQueue } from "@/lib/fs011-workflow-data";

export default async function WorkflowsPage() {
  const queue = await readWorkflowApprovalQueue();

  return (
    <WorkspaceChrome>
      <WorkspaceHeader
        scope="Workflows"
        title="Autonomous action approvals"
        context="FS-011 · pending_approval queue — SmartAssist proposes, you decide"
      />
      <WorkspaceMain>
        <WorkspaceStack>
          <WorkflowApprovalWorkspace initialData={queue} />
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
