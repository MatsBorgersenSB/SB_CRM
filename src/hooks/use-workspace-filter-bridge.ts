"use client";

import { useEffect } from "react";
import type { WorkspaceFilterId, WorkspaceFilterValues } from "@/types/workspace-filters";
import { consumeWorkspaceFilters, parseFilterParams } from "@/lib/workspace-filter-bridge";

export function useWorkspaceFilterBridge(
  workspace: WorkspaceFilterId,
  filterKeys: string[],
  apply: (patch: {
    filters?: WorkspaceFilterValues;
    search?: string;
    owner?: string;
  }) => void,
): void {
  useEffect(() => {
    const fromStorage = consumeWorkspaceFilters(workspace);
    if (fromStorage) {
      apply({
        filters: fromStorage.filters,
        search: fromStorage.search,
        owner: fromStorage.owner,
      });
      return;
    }

    if (typeof window === "undefined") return;

    const fromUrl = parseFilterParams(
      new URLSearchParams(window.location.search),
      filterKeys,
    );
    const hasUrlFilters =
      Object.keys(fromUrl.filters).length > 0 ||
      fromUrl.search.length > 0 ||
      fromUrl.owner !== "all";

    if (hasUrlFilters) {
      apply({
        filters: fromUrl.filters,
        search: fromUrl.search || undefined,
        owner: fromUrl.owner !== "all" ? fromUrl.owner : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per workspace mount
  }, [workspace]);
}
