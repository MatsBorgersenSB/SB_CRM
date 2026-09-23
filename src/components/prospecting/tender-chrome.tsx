import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { TenderListItem } from "@/lib/tenders/types";

export function countdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "Due today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

export function formatTenderBudget(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function TechnologyBadges({
  type,
}: {
  type: TenderListItem["technologyType"];
}) {
  const showPyrolysis = type === "Pyrolysis" || type === "Both";
  const showTorrefaction = type === "Torrefaction" || type === "Both";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {showPyrolysis ? <Badge variant="primary">Pyrolysis</Badge> : null}
      {showTorrefaction ? <Badge variant="outline">Torrefaction</Badge> : null}
    </span>
  );
}

export function SectorBadge({ sector }: { sector: TenderListItem["sectorTag"] }) {
  return <Badge variant="default">{sector}</Badge>;
}

export function DeadlineBadge({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium tracking-tight",
        urgent ? "text-destructive" : "text-foreground",
      )}
    >
      <Clock className="size-3.5" strokeWidth={1.75} />
      {countdownLabel(daysLeft)}
    </span>
  );
}
