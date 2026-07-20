import type { CommercialPackage } from "@/types/commercial-package";
import {
  COMMERCIAL_PACKAGE_KIND_LABELS,
  type CommercialPackageKind,
} from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";

export type CommercialHistoryRow = {
  id: string;
  type: string;
  dateIso: string;
  dateLabel: string;
  recipient: string;
  valueLabel: string;
  status: string;
};

export type LatestCommercialPosition = {
  valueLabel: string;
  dateSentLabel: string;
  recipient: string;
  status: string;
  type: string;
};

const STORY_KINDS: CommercialPackageKind[] = [
  "price_indication",
  "budget_quotation",
  "formal_quotation",
  "transmission",
  "commercial_baseline",
];

function formatCommercialDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCommercialStatus(status: CommercialPackage["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function packageDate(pkg: CommercialPackage): string {
  return pkg.sentAt ?? pkg.acceptedAt ?? pkg.CreatedAt ?? "";
}

export function buildCommercialHistory(
  pipeline: PipelineRow,
  packages: CommercialPackage[],
): { history: CommercialHistoryRow[]; latest: LatestCommercialPosition } {
  const dealPackages = packages.filter((record) => record.DealId === pipeline.id);
  const valueLabel = formatDealValue(pipeline.currency, pipeline.salesValue);

  const history = dealPackages
    .filter((pkg) => STORY_KINDS.includes(pkg.kind))
    .map((pkg) => ({
      id: pkg.PackageID,
      type: COMMERCIAL_PACKAGE_KIND_LABELS[pkg.kind],
      dateIso: packageDate(pkg),
      dateLabel: formatCommercialDate(packageDate(pkg)),
      recipient: pkg.recipient ?? "—",
      valueLabel,
      status: formatCommercialStatus(pkg.status),
    }))
    .sort((a, b) => new Date(a.dateIso || 0).getTime() - new Date(b.dateIso || 0).getTime());

  const transmission = [...dealPackages]
    .filter((pkg) => pkg.kind === "transmission")
    .sort((a, b) => new Date(packageDate(b)).getTime() - new Date(packageDate(a)).getTime())[0];

  const baseline = [...dealPackages]
    .filter((pkg) => pkg.kind === "commercial_baseline")
    .sort((a, b) => new Date(packageDate(b)).getTime() - new Date(packageDate(a)).getTime())[0];

  const latestQuotation = [...dealPackages]
    .filter(
      (pkg) =>
        pkg.kind === "formal_quotation" ||
        pkg.kind === "budget_quotation" ||
        pkg.kind === "price_indication",
    )
    .sort((a, b) => new Date(packageDate(b)).getTime() - new Date(packageDate(a)).getTime())[0];

  const anchor = baseline ?? transmission ?? latestQuotation;

  const latest: LatestCommercialPosition = anchor
    ? {
        valueLabel,
        dateSentLabel: formatCommercialDate(
          transmission?.sentAt ?? anchor.sentAt ?? anchor.acceptedAt ?? anchor.CreatedAt,
        ),
        recipient: transmission?.recipient ?? anchor.recipient ?? "—",
        status: formatCommercialStatus(anchor.status),
        type: COMMERCIAL_PACKAGE_KIND_LABELS[anchor.kind],
      }
    : history.length > 0
      ? {
          valueLabel,
          dateSentLabel: history[history.length - 1]!.dateLabel,
          recipient: history[history.length - 1]!.recipient,
          status: history[history.length - 1]!.status,
          type: history[history.length - 1]!.type,
        }
      : {
          valueLabel,
          dateSentLabel: "—",
          recipient: "—",
          status: "Open",
          type: "Opportunity",
        };

  return { history, latest };
}
