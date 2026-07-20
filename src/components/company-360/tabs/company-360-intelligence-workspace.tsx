import type { Company360IntelligenceView } from "@/lib/company-360-data";
import type { CompanyRelationshipGraph } from "@/types/relationship-graph";
import { Company360IntelligenceTab } from "@/components/company-360/tabs/company-360-intelligence-tab";
import { Company360GraphTab } from "@/components/company-360/tabs/company-360-graph-tab";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export function Company360IntelligenceWorkspace({
  intelligence,
  graph,
}: {
  intelligence: Company360IntelligenceView;
  graph: CompanyRelationshipGraph;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Company360IntelligenceTab intelligence={intelligence} />

      <CollapsibleSection
        title="Relationship network"
        description="Who is connected and what depends on whom"
        tier="nice-to-have"
      >
        <Company360GraphTab graph={graph} embedded />
      </CollapsibleSection>
    </div>
  );
}
