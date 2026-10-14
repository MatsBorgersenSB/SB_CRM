import { ActivityCalendar } from "@/components/calendar/activity-calendar";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <WorkspaceChrome>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground">Calendar</h1>
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            What is scheduled, and what is still to do
          </p>
        </div>
        <ThemeToggle />
      </header>
      <ActivityCalendar />
    </WorkspaceChrome>
  );
}
