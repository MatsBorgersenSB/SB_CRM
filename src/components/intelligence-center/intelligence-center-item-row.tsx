import Link from "next/link";
import type { IntelligenceCenterItem } from "@/lib/intelligence-center-data";
import { ImpactContext } from "@/components/ui/impact-context";

export function IntelligenceCenterItemRow({
  item,
  compact = false,
}: {
  item: IntelligenceCenterItem;
  compact?: boolean;
}) {
  const impact = compact ? [item.subtitle] : [item.subtitle];

  return (
    <Link
      href={item.href}
      className="group block border-b border-carbon-blue/6 px-6 py-4 last:border-b-0 transition-colors hover:bg-carbon-blue/[0.02]"
    >
      <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
        {item.companyName}
      </p>
      <p className="mt-1 text-[11px] font-medium text-carbon-blue/70">{item.nextBestAction}</p>
      <ImpactContext items={impact} />
    </Link>
  );
}
