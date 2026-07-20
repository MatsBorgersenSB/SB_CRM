import type { PageRequest } from "@/services/sharepoint/client/pagination";
import {
  SharePointServiceError,
  toSharePointServiceError,
} from "@/services/sharepoint/client/errors";
import { NextResponse } from "next/server";

export function parsePageRequest(request: Request): PageRequest {
  const url = new URL(request.url);
  const pageSize = url.searchParams.get("pageSize");
  const skipToken = url.searchParams.get("skipToken");
  const filter = url.searchParams.get("filter");
  const orderBy = url.searchParams.get("orderBy");

  return {
    pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    skipToken: skipToken ?? undefined,
    filter: filter ?? undefined,
    orderBy: orderBy ?? undefined,
  };
}

export function sharePointErrorResponse(error: unknown) {
  const normalized =
    error instanceof SharePointServiceError
      ? error
      : toSharePointServiceError(error);

  return NextResponse.json(
    {
      error: normalized.message,
      code: normalized.code,
      details: normalized.details,
    },
    { status: normalized.statusCode ?? 500 },
  );
}
