import type { SharePointListKey } from "@/services/sharepoint/config/lists";
import { resolveListName } from "@/services/sharepoint/config/lists";
import { getSharePointEnvironment } from "@/services/sharepoint/config/environment";
import type { ICacheProvider } from "@/services/sharepoint/client/cache-provider";
import { NoOpCacheProvider } from "@/services/sharepoint/client/cache-provider";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { GraphHttpClient } from "@/services/sharepoint/client/graph-http-client";
import {
  buildGraphListQuery,
  extractSkipToken,
  type GraphListResponse,
  type PageRequest,
  type PageResult,
} from "@/services/sharepoint/client/pagination";
import type {
  GraphListItem,
  IListRepository,
  ListItemMapper,
} from "@/services/sharepoint/client/types";

/**
 * Generic Microsoft Graph SharePoint list client.
 * All entity services route list operations through this class.
 */
export class SharePointListClient {
  constructor(
    private readonly graph: GraphHttpClient,
    private readonly cache: ICacheProvider = new NoOpCacheProvider(),
  ) {}

  private listPath(listKey: SharePointListKey): string {
    const env = getSharePointEnvironment();
    const listName = resolveListName(listKey);

    if (!env.siteId) {
      throw SharePointServiceError.validation(
        "SHAREPOINT_SITE_ID is required for Graph list operations",
      );
    }

    return `/sites/${env.siteId}/lists/${encodeURIComponent(listName)}`;
  }

  private cacheKey(
    listKey: SharePointListKey,
    suffix: string,
    page?: PageRequest,
  ): string {
    return `sp:${listKey}:${suffix}:${JSON.stringify(page ?? {})}`;
  }

  async listItems<TFields extends Record<string, unknown>, TDomain>(
    listKey: SharePointListKey,
    mapper: ListItemMapper<TFields, TDomain>,
    page?: PageRequest,
  ): Promise<PageResult<TDomain>> {
    const cacheKey = this.cacheKey(listKey, "list", page);
    const cached = await this.cache.get<PageResult<TDomain>>(cacheKey);
    if (cached) return cached;

    const query = buildGraphListQuery(page);
    const response = await this.graph.request<
      GraphListResponse<GraphListItem<TFields>>
    >(`${this.listPath(listKey)}/items?${query}`);

    const result: PageResult<TDomain> = {
      items: response.value.map((item) => mapper.toDomain(item)),
      nextSkipToken: extractSkipToken(response["@odata.nextLink"]),
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }

  async getItem<TFields extends Record<string, unknown>, TDomain>(
    listKey: SharePointListKey,
    itemId: string | number,
    mapper: ListItemMapper<TFields, TDomain>,
  ): Promise<TDomain> {
    const response = await this.graph.request<GraphListItem<TFields>>(
      `${this.listPath(listKey)}/items/${itemId}?$expand=fields`,
    );
    return mapper.toDomain(response);
  }

  async createItem<TFields extends Record<string, unknown>, TDomain>(
    listKey: SharePointListKey,
    mapper: ListItemMapper<TFields, TDomain>,
    input: Partial<TDomain>,
  ): Promise<TDomain> {
    const response = await this.graph.request<GraphListItem<TFields>>(
      `${this.listPath(listKey)}/items`,
      {
        method: "POST",
        body: { fields: mapper.toFields(input) },
      },
    );

    await this.cache.invalidate(`sp:${listKey}:*`);
    return mapper.toDomain(response);
  }

  async updateItem<TFields extends Record<string, unknown>, TDomain>(
    listKey: SharePointListKey,
    itemId: string | number,
    mapper: ListItemMapper<TFields, TDomain>,
    patch: Partial<TDomain>,
  ): Promise<TDomain> {
    await this.graph.request(
      `${this.listPath(listKey)}/items/${itemId}/fields`,
      {
        method: "PATCH",
        body: mapper.toFields(patch),
      },
    );

    await this.cache.invalidate(`sp:${listKey}:*`);
    return this.getItem(listKey, itemId, mapper);
  }

  async deleteItem(
    listKey: SharePointListKey,
    itemId: string | number,
  ): Promise<void> {
    await this.graph.request(`${this.listPath(listKey)}/items/${itemId}`, {
      method: "DELETE",
    });
    await this.cache.invalidate(`sp:${listKey}:*`);
  }

  /** Wraps a local repository for hybrid/dev fallback inside Graph transport tests. */
  bindRepository<TDomain, TCreate, TUpdate>(
    repository: IListRepository<TDomain, TCreate, TUpdate>,
  ): IListRepository<TDomain, TCreate, TUpdate> {
    return repository;
  }
}
