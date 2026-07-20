import type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";
import {
  SharePointServiceError,
  toSharePointServiceError,
} from "@/services/sharepoint/client/errors";
import { readResponseBody } from "@/services/sharepoint/client/response-body";
import type { SearchQuery, SearchResult } from "@/services/sharepoint/client/types";
import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

function buildQuery(page?: PageRequest): string {
  if (!page) return "";
  const params = new URLSearchParams();
  if (page.pageSize) params.set("pageSize", String(page.pageSize));
  if (page.skipToken) params.set("skipToken", page.skipToken);
  if (page.filter) params.set("filter", page.filter);
  if (page.orderBy) params.set("orderBy", page.orderBy);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export class HttpSharePointEntityService<T, TCreate, TUpdate>
  implements ISharePointEntityService<T, TCreate, TUpdate>
{
  constructor(private readonly basePath: string) {}

  private async request<TResult>(
    path: string,
    init?: RequestInit,
  ): Promise<TResult> {
    try {
      const response = await fetch(path, {
        headers: { "Content-Type": "application/json", ...init?.headers },
        ...init,
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        throw SharePointServiceError.fromResponse(response, body);
      }

      if (response.status === 204) return undefined as TResult;
      return body as TResult;
    } catch (error) {
      throw toSharePointServiceError(error);
    }
  }

  async list(page?: PageRequest): Promise<PageResult<T>> {
    return this.request<PageResult<T>>(`${this.basePath}${buildQuery(page)}`);
  }

  async getById(id: string | number): Promise<T> {
    return this.request<T>(`${this.basePath}/${encodeURIComponent(String(id))}`);
  }

  async create(input: TCreate): Promise<T> {
    return this.request<T>(this.basePath, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async update(id: string | number, patch: TUpdate): Promise<T> {
    return this.request<T>(`${this.basePath}/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  async delete(id: string | number): Promise<void> {
    await this.request<void>(`${this.basePath}/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
  }

  async search(query: SearchQuery): Promise<SearchResult<T>> {
    return this.request<SearchResult<T>>(`${this.basePath}/search`, {
      method: "POST",
      body: JSON.stringify(query),
    });
  }
}
