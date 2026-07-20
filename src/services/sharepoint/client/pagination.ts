export type PageRequest = {
  pageSize?: number;
  skipToken?: string;
  filter?: string;
  orderBy?: string;
  select?: string[];
};

export type PageResult<T> = {
  items: T[];
  nextSkipToken?: string;
  totalCount?: number;
};

export type GraphListResponse<TItem> = {
  value: TItem[];
  "@odata.nextLink"?: string;
};

export function extractSkipToken(nextLink?: string): string | undefined {
  if (!nextLink) return undefined;

  try {
    const url = new URL(nextLink);
    return url.searchParams.get("$skiptoken") ?? nextLink;
  } catch {
    return nextLink;
  }
}

export function paginateArray<T>(
  items: T[],
  request: PageRequest = {},
): PageResult<T> {
  const pageSize = request.pageSize ?? 50;
  const offset = request.skipToken ? Number.parseInt(request.skipToken, 10) : 0;
  const start = Number.isFinite(offset) ? offset : 0;
  const slice = items.slice(start, start + pageSize);
  const next = start + pageSize;

  return {
    items: slice,
    nextSkipToken: next < items.length ? String(next) : undefined,
    totalCount: items.length,
  };
}

export function buildGraphListQuery(request: PageRequest = {}): string {
  const params = new URLSearchParams();
  params.set("$expand", "fields");
  params.set("$top", String(request.pageSize ?? 50));

  if (request.filter) params.set("$filter", request.filter);
  if (request.orderBy) params.set("$orderby", request.orderBy);
  if (request.select?.length) {
    params.set("$select", request.select.join(","));
  }
  if (request.skipToken) {
    params.set("$skiptoken", request.skipToken);
  }

  return params.toString();
}
