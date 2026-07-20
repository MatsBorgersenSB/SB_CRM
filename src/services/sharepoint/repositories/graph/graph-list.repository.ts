import type { SharePointListKey } from "@/services/sharepoint/config/lists";
import type { SharePointListClient } from "@/services/sharepoint/client/sharepoint-list-client";
import type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";
import type {
  GraphListItem,
  IListRepository,
  ListItemMapper,
} from "@/services/sharepoint/client/types";

export class GraphListRepository<
  TFields extends Record<string, unknown>,
  TDomain,
  TCreate,
  TUpdate,
> implements IListRepository<TDomain, TCreate, TUpdate>
{
  constructor(
    private readonly client: SharePointListClient,
    private readonly listKey: SharePointListKey,
    private readonly mapper: ListItemMapper<TFields, TDomain>,
    private readonly resolveId: (item: TDomain) => string | number = (item) =>
      (item as { id: string | number }).id,
  ) {}

  list(page?: PageRequest): Promise<PageResult<TDomain>> {
    return this.client.listItems(this.listKey, this.mapper, page);
  }

  getById(id: string | number): Promise<TDomain> {
    return this.client.getItem(this.listKey, id, this.mapper);
  }

  create(input: TCreate): Promise<TDomain> {
    return this.client.createItem(
      this.listKey,
      this.mapper,
      input as Partial<TDomain>,
    );
  }

  update(id: string | number, patch: TUpdate): Promise<TDomain> {
    return this.client.updateItem(this.listKey, id, this.mapper, patch as Partial<TDomain>);
  }

  delete(id: string | number): Promise<void> {
    return this.client.deleteItem(this.listKey, id);
  }
}

export type { GraphListItem, ListItemMapper };
