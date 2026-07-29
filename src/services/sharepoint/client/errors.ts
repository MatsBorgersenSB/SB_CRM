export type SharePointErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "GRAPH_ERROR"
  | "NETWORK"
  | "UNKNOWN";

export class SharePointServiceError extends Error {
  readonly code: SharePointErrorCode;
  readonly statusCode?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: SharePointErrorCode = "UNKNOWN",
    options?: { statusCode?: number; details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "SharePointServiceError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
  }

  static fromResponse(
    response: Response,
    details?: unknown,
  ): SharePointServiceError {
    const status = response.status;
    const code: SharePointErrorCode =
      status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : status === 404
            ? "NOT_FOUND"
            : status === 409
              ? "CONFLICT"
              : status === 429
                ? "RATE_LIMITED"
                : status >= 400 && status < 500
                  ? "VALIDATION"
                  : "GRAPH_ERROR";

    return new SharePointServiceError(
      typeof details === "object" &&
        details &&
        "error" in details &&
        typeof (details as { error?: unknown }).error === "string"
        ? (details as { error: string }).error
        : typeof details === "object" &&
            details &&
            "message" in details &&
            typeof (details as { message?: unknown }).message === "string"
          ? (details as { message: string }).message
          : `SharePoint request failed (${status})`,
      code,
      { statusCode: status, details },
    );
  }

  static notFound(entity: string, id: string | number): SharePointServiceError {
    return new SharePointServiceError(`${entity} not found: ${id}`, "NOT_FOUND", {
      statusCode: 404,
    });
  }

  static validation(message: string, details?: unknown): SharePointServiceError {
    return new SharePointServiceError(message, "VALIDATION", {
      statusCode: 400,
      details,
    });
  }

  static forbidden(message: string, details?: unknown): SharePointServiceError {
    return new SharePointServiceError(message, "FORBIDDEN", {
      statusCode: 403,
      details,
    });
  }

  static conflict(message: string, details?: unknown): SharePointServiceError {
    return new SharePointServiceError(message, "CONFLICT", {
      statusCode: 409,
      details,
    });
  }
}

export function isSharePointServiceError(
  error: unknown,
): error is SharePointServiceError {
  return error instanceof SharePointServiceError;
}

export function toSharePointServiceError(error: unknown): SharePointServiceError {
  if (isSharePointServiceError(error)) return error;

  if (error instanceof Error) {
    return new SharePointServiceError(error.message, "UNKNOWN", {
      cause: error,
    });
  }

  return new SharePointServiceError("Unknown SharePoint service error", "UNKNOWN", {
    details: error,
  });
}
