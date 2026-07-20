import type { SearchQuery, SearchResult } from "@/services/sharepoint/client/types";

/** Future AI / Microsoft Search integration hook. */
export interface ISearchProvider {
  search<T>(query: SearchQuery): Promise<SearchResult<T>>;
}

export class NoOpSearchProvider implements ISearchProvider {
  async search<T>(): Promise<SearchResult<T>> {
    return { hits: [], total: 0 };
  }
}
