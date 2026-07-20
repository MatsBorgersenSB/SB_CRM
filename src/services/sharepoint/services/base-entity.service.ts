import type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";
import type {
  IListRepository,
  SearchQuery,
  SearchResult,
} from "@/services/sharepoint/client/types";
import type { ISearchProvider } from "@/services/sharepoint/client/search-provider";
import { NoOpSearchProvider } from "@/services/sharepoint/client/search-provider";
import { toSharePointServiceError } from "@/services/sharepoint/client/errors";
import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

export class BaseSharePointEntityService<T, TCreate, TUpdate>
  implements ISharePointEntityService<T, TCreate, TUpdate>
{
  constructor(
  protected readonly repository: IListRepository<T, TCreate, TUpdate>,
    protected readonly searchProvider: ISearchProvider = new NoOpSearchProvider(),
    protected readonly searchEntityType?: string,
  ) {}

  async list(page?: PageRequest): Promise<PageResult<T>> {
    try {
      return await this.repository.list(page);
    } catch (error) {
      throw toSharePointServiceError(error);
    }
  }

  async getById(id: string | number): Promise<T> {
    try {
      return await this.repository.getById(id);
    } catch (error) {
      throw toSharePointServiceError(error);
    }
  }

  async create(input: TCreate): Promise<T> {
    try {
      return await this.repository.create(input);
    } catch (error) {
      throw toSharePointServiceError(error);
    }
  }

  async update(id: string | number, patch: TUpdate): Promise<T> {
    try {
      return await this.repository.update(id, patch);
    } catch (error) {
      throw toSharePointServiceError(error);
    }
  }

  async delete(id: string | number): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      throw toSharePointServiceError(error);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult<T>> {
    return this.searchProvider.search<T>({
      ...query,
      filter: query.filter ?? this.searchEntityType,
    });
  }
}
