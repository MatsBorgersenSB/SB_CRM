import type { ReactNode } from "react";
import type { CopilotBriefing } from "@/types/smartcrm-copilot";
import { SmartCRMCopilotPanel } from "@/components/copilot/smartcrm-copilot-panel";

type CopilotPageLayoutProps = {
  children: ReactNode;
  briefing: CopilotBriefing;
  /** When true, copilot stacks above content on small screens (dashboard). */
  stackOnMobile?: boolean;
};

export function CopilotPageLayout({
  children,
  briefing,
  stackOnMobile = false,
}: CopilotPageLayoutProps) {
  if (stackOnMobile) {
    return (
      <div className="flex flex-col gap-4">
        <SmartCRMCopilotPanel briefing={briefing} />
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="w-full shrink-0 xl:sticky xl:top-4 xl:w-80">
        <SmartCRMCopilotPanel briefing={briefing} />
      </div>
    </div>
  );
}
