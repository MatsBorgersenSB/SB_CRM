"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SearchIndexItem } from "@/types/universal-search";
import { UniversalSearchDialog } from "@/components/search/universal-search-dialog";
import { UniversalSearchContext } from "@/context/universal-search-context";

type SearchIndexPayload = {
  index: SearchIndexItem[];
  meta: {
    companies: Company[];
    pipelines: PipelineRow[];
    activities: Activity[];
    commercialPackages: CommercialPackage[];
  };
};

export function UniversalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndexItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commercialPackages, setCommercialPackages] = useState<CommercialPackage[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadIndex = useCallback(async () => {
    try {
      const response = await fetch("/api/search/index");
      if (!response.ok) return;
      const data = (await response.json()) as SearchIndexPayload;
      setIndex(data.index);
      setCompanies(data.meta.companies);
      setPipelines(data.meta.pipelines);
      setActivities(data.meta.activities ?? []);
      setCommercialPackages(data.meta.commercialPackages ?? []);
      setLoaded(true);
    } catch {
      // Search remains usable with empty index
    }
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (open && !loaded) void loadIndex();
  }, [open, loaded, loadIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = {
    open,
    openSearch: () => setOpen(true),
    closeSearch: () => setOpen(false),
    toggleSearch: () => setOpen((current) => !current),
  };

  return (
    <UniversalSearchContext.Provider value={value}>
      {children}
      <UniversalSearchDialog
        open={open}
        onClose={() => setOpen(false)}
        index={index}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </UniversalSearchContext.Provider>
  );
}
