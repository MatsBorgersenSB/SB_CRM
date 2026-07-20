import Link from "next/link";
import { deal360Href } from "@/types/relationship-navigation";

const badgeClassName =
  "inline-block border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 font-mono text-[9px] text-upcycle-orange transition-colors hover:border-upcycle-orange/50 hover:bg-upcycle-orange/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upcycle-orange/40";

export function PipelineDealBadge({
  pipelineId,
  onSelect,
  dealName,
}: {
  pipelineId: string;
  onSelect?: (pipelineId: string) => void;
  dealName?: string;
}) {
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(pipelineId);
        }}
        className={badgeClassName}
      >
        {dealName ?? pipelineId}
      </button>
    );
  }

  return (
    <Link
      href={deal360Href(pipelineId)}
      onClick={(event) => event.stopPropagation()}
      className={badgeClassName}
    >
      {dealName ?? pipelineId}
    </Link>
  );
}
