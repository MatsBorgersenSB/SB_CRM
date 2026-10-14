import type { ReactNode } from "react";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import type { SmartCRMIconName } from "@/lib/smartcrm-visual-language";

/**
 * The one page title block for list workspaces: the sidebar word as h1,
 * one plain-language line on what the page holds, and the page's
 * single primary action on the right.
 */
export function WorkspacePageTitle({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: SmartCRMIconName;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-carbon-blue sm:text-2xl">
          <SmartCRMIcon name={icon} size="md" className="text-carbon-blue/60" />
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-carbon-blue/65">{subtitle}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
