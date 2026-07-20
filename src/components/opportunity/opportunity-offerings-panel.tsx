"use client";

import { useEffect, useMemo, useState } from "react";
import type { PipelineRow } from "@/types/pipeline";
import {
  buildOpportunityOfferingSelection,
  resolveOfferings,
} from "@/lib/standard-bio-offerings";
import { OpportunityOfferingsPicker } from "@/components/opportunity/opportunity-offerings-picker";
import { EDITORIAL_LABEL } from "@/lib/editorial-design-system";
import { OFFERING_CATEGORY_LABELS } from "@/types/offering";

export function OpportunityOfferingsPanel({
  pipeline,
  onSave,
  readOnly = false,
}: {
  pipeline: PipelineRow;
  onSave?: (offeringIds: string[]) => Promise<void>;
  readOnly?: boolean;
}) {
  const selection = useMemo(
    () => buildOpportunityOfferingSelection(pipeline.offeringIds),
    [pipeline.offeringIds],
  );
  const [draftIds, setDraftIds] = useState<string[]>(selection.offeringIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftIds(selection.offeringIds);
  }, [selection.offeringIds]);

  const persist = async (nextIds: string[]) => {
    if (!onSave) {
      setDraftIds(nextIds);
      return;
    }
    if (nextIds.length === 0) {
      setError("Keep at least one offering, or SmartAssist cannot qualify this opportunity.");
      setDraftIds(selection.offeringIds);
      return;
    }
    setSaving(true);
    setError(null);
    setDraftIds(nextIds);
    try {
      await onSave(nextIds);
    } catch (err) {
      setDraftIds(selection.offeringIds);
      setError(err instanceof Error ? err.message : "Could not save offerings");
    } finally {
      setSaving(false);
    }
  };

  if (readOnly || !onSave) {
    const offerings = resolveOfferings(pipeline.offeringIds);
    return (
      <section>
        <p className={EDITORIAL_LABEL}>Selected offerings</p>
        {offerings.length === 0 ? (
          <p className="mt-2 text-[13px] text-carbon-blue/55">
            Unknown — no offerings linked.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {offerings.map((offering) => (
              <span
                key={offering.id}
                className="inline-flex border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1 text-[12px] font-medium text-carbon-blue"
                title={OFFERING_CATEGORY_LABELS[offering.category]}
              >
                {offering.name}
              </span>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <OpportunityOfferingsPicker
        selectedIds={draftIds}
        onChange={(ids) => void persist(ids)}
        disabled={saving}
        label="Selected offerings"
        helper="What Standard Bio is selling on this opportunity."
      />
      {error ? <p className="mt-2 text-[12px] text-thermal-red">{error}</p> : null}
    </section>
  );
}
