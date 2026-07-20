import {
  SharePointServiceError,
  toSharePointServiceError,
} from "@/services/sharepoint/client/errors";
import { readResponseBody } from "@/services/sharepoint/client/response-body";
import type { IGraphTokenProvider } from "@/services/sharepoint/client/token-provider";
import { getSharePointEnvironment } from "@/services/sharepoint/config/environment";

export type GraphRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
};

export class GraphHttpClient {
  constructor(private readonly tokenProvider: IGraphTokenProvider) {}

  async request<T>(path: string, options: GraphRequestOptions = {}): Promise<T> {
    const env = getSharePointEnvironment();
    const token = await this.tokenProvider.getAccessToken();
    const url = path.startsWith("http")
      ? path
      : `${env.graphBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        throw SharePointServiceError.fromResponse(response, body);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return body as T;
    } catch (error) {
      if (error instanceof SharePointServiceError) throw error;
      throw toSharePointServiceError(error);
    }
  }
}
