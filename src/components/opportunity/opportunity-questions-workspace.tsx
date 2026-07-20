"use client";

import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import { OpportunitySmartAssistActions } from "@/components/opportunity/opportunity-smartassist-actions";
import {
  EDITORIAL_BODY,
  EDITORIAL_CONTENT,
  EDITORIAL_DIVIDER,
  EDITORIAL_GAP_LIST,
  EDITORIAL_GAP_PAGE,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

export function OpportunityQuestionsWorkspace({
  pipeline,
  companies,
  commercialPackages,
  understanding,
  questions,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  commercialPackages: CommercialPackage[];
  understanding: OpportunityUnderstanding;
  questions: string[];
}) {
  return (
    <div className={`flex ${EDITORIAL_CONTENT} flex-col ${EDITORIAL_GAP_PAGE}`}>
      <OpportunitySmartAssistActions
        pipeline={pipeline}
        companies={companies}
        commercialPackages={commercialPackages}
        understanding={understanding}
        activities={[]}
        actions={["email", "meeting"]}
      />

      {questions.length > 0 ? (
        <div className={`${EDITORIAL_DIVIDER} pt-8`}>
          <p className={EDITORIAL_LABEL}>Discovery questions</p>
          <ul className={`mt-4 ${EDITORIAL_GAP_LIST}`}>
            {questions.map((item) => (
              <li key={item} className={EDITORIAL_BODY}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
