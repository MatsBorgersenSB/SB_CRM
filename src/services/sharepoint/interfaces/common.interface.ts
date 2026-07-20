import type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";
import type { SearchQuery, SearchResult } from "@/services/sharepoint/client/types";

export interface ISharePointEntityService<T, TCreate, TUpdate> {
  list(page?: PageRequest): Promise<PageResult<T>>;
  getById(id: string | number): Promise<T>;
  create(input: TCreate): Promise<T>;
  update(id: string | number, patch: TUpdate): Promise<T>;
  delete(id: string | number): Promise<void>;
  search?(query: SearchQuery): Promise<SearchResult<T>>;
}
