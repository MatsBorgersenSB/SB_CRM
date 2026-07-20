import type { Document360Snapshot } from "@/lib/document-360-data";
import {
  Document360BusinessContextCard,
  Document360IdentityCard,
  Document360IntelligenceCard,
  Document360RelatedCard,
  Document360SetCard,
  Document360SharePointVersionsCard,
} from "@/components/smartdocs/document-360-overview-sections";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

/** Lean overview — business meaning first, metadata collapsed. */
export function Document360OverviewTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { businessContext, documentSet } = snapshot;

  return (
    <div className="flex flex-col gap-4">
      <section className="dashboard-card px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Business context
        </p>
        <p className="mt-2 text-sm font-medium text-carbon-blue">
          {businessContext.dealName}
        </p>
        <p className="mt-1 text-[11px] text-carbon-blue/55">
          {businessContext.clientName} · {businessContext.commercialStage}
        </p>
        <p className="mt-1 font-mono text-[10px] text-carbon-blue/40">{businessContext.plNumber}</p>
      </section>

      {documentSet ? <Document360SetCard snapshot={snapshot} /> : null}

      <Document360RelatedCard snapshot={snapshot} />

      <CollapsibleSection
        title="Document details"
        description="Identity, upload metadata, and technical fields"
        tier="expert"
      >
        <div className="flex flex-col gap-4">
          <Document360IdentityCard snapshot={snapshot} bare />
          <Document360IntelligenceCard snapshot={snapshot} bare />
          <Document360BusinessContextCard snapshot={snapshot} bare />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="SharePoint version history"
        description="Authoritative versioning in SharePoint"
        tier="expert"
      >
        <Document360SharePointVersionsCard snapshot={snapshot} bare />
      </CollapsibleSection>
    </div>
  );
}
