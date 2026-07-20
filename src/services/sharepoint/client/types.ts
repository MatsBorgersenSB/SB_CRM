import type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";

export type GraphListItem<TFields extends Record<string, unknown>> = {
  id: string;
  fields: TFields;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
};

export type ListItemMapper<TFields extends Record<string, unknown>, TDomain> = {
  toDomain: (item: GraphListItem<TFields>) => TDomain;
  toFields: (input: Partial<TDomain>) => Record<string, unknown>;
};

export type IListRepository<TDomain, TCreate, TUpdate> = {
  list(page?: PageRequest): Promise<PageResult<TDomain>>;
  getById(id: string | number): Promise<TDomain>;
  create(input: TCreate): Promise<TDomain>;
  update(id: string | number, patch: TUpdate): Promise<TDomain>;
  delete(id: string | number): Promise<void>;
};

export type SearchQuery = {
  query: string;
  listKey?: string;
  top?: number;
  filter?: string;
};

export type SearchHit<T> = {
  score: number;
  item: T;
  highlights?: string[];
};

export type SearchResult<T> = {
  hits: SearchHit<T>[];
  total?: number;
};
