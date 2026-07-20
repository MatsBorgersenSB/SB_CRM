"use client";

import { useCallback, useEffect, useState } from "react";
import { MissingTouchpointsPanel } from "@/components/m365/missing-touchpoints-panel";
import { OUTLOOK_RELATIONSHIP_RECONCILIATION } from "@/lib/smart-assist-config";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { PipelineRow } from "@/types/pipeline";

export function OutlookReconciliationWorkspace({
  companies,
  pipelines,
  activities: initialActivities,
  outlookEvidence: initialEvidence,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence: OutlookEvidenceRecord[];
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [outlookEvidence, setOutlookEvidence] = useState(initialEvidence);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(async () => {
    const [activitiesResponse, reconciliationResponse] = await Promise.all([
      fetch("/api/activities").catch(() => null),
      fetch("/api/m365/reconciliation").catch(() => null),
    ]);

    if (activitiesResponse?.ok) {
      const body = (await activitiesResponse.json()) as { items?: Activity[] } | Activity[];
      const rows = Array.isArray(body) ? body : (body.items ?? []);
      if (rows.length > 0) setActivities(rows);
    }

    if (reconciliationResponse?.ok) {
      setRefreshKey((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return (
    <div className="flex flex-col gap-4">
      <header className="border border-carbon-blue/10 bg-white px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-upcycle-orange">
          {OUTLOOK_RELATIONSHIP_RECONCILIATION.title}
        </p>
        <p className="mt-1 text-sm text-carbon-blue/70">
          {OUTLOOK_RELATIONSHIP_RECONCILIATION.principle}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {OUTLOOK_RELATIONSHIP_RECONCILIATION.detects.map((item) => (
            <li
              key={item}
              className="border border-carbon-blue/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/55"
            >
              {item}
            </li>
          ))}
        </ul>
      </header>

      <MissingTouchpointsPanel
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        outlookEvidence={outlookEvidence}
        onImported={() => void reload()}
      />
    </div>
  );
}
