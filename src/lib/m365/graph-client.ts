/**
 * Microsoft Graph helpers for SharePoint Online document provisioning.
 * SharePoint Online is the single source of truth for opportunity documents.
 *
 * Hierarchy: /Opportunities/{CompanyName}/{OpportunityTitle}
 */

const GRAPH_BASE =
  process.env.MICROSOFT_GRAPH_BASE_URL?.replace(/\/$/, "") ??
  "https://graph.microsoft.com/v1.0";

export type OpportunitySharePointFolder = {
  folderId: string;
  webUrl: string;
  name: string;
  /** Drive-relative path, e.g. Opportunities/Acme/Deal-Title */
  path: string;
};

type DriveItem = {
  id?: string;
  webUrl?: string;
  name?: string;
};

/**
 * Sanitizes folder names according to SharePoint / Office 365 restrictions.
 * Removes forbidden characters: ~ # % * { } \ : < > ? / | "
 * Trims leading/trailing dots and whitespace.
 */
export function sanitizeSharePointName(name: string): string {
  const cleaned = name
    .replace(/[~#%*{}\\:<>?/|"]/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned || "Untitled";
}

/** @deprecated Prefer `sanitizeSharePointName` — kept for existing imports. */
export function sanitizeSharePointFolderName(name: string): string {
  return sanitizeSharePointName(name);
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Encode a multi-segment drive path for Graph `root:/…` addressing. */
function encodeDrivePath(segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

async function getDriveItemByPath(
  accessToken: string,
  siteId: string,
  segments: string[],
): Promise<DriveItem | null> {
  const path = encodeDrivePath(segments);
  const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/root:/${path}`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error (${res.status}): ${err}`);
  }

  return (await res.json()) as DriveItem;
}

async function createChildFolder(
  accessToken: string,
  siteId: string,
  parentSegments: string[],
  folderName: string,
): Promise<DriveItem> {
  const endpoint =
    parentSegments.length === 0
      ? `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/root/children`
      : `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/root:/${encodeDrivePath(parentSegments)}:/children`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      name: folderName,
      folder: {},
      // Graph only accepts fail | replace | rename (not "select").
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (res.ok) {
    return (await res.json()) as DriveItem;
  }

  const err = await res.text();
  const alreadyExists =
    res.status === 409 ||
    /nameAlreadyExists|already exists|conflict/i.test(err);

  if (alreadyExists) {
    const existing = await getDriveItemByPath(accessToken, siteId, [
      ...parentSegments,
      folderName,
    ]);
    if (existing?.id) return existing;
  }

  throw new Error(`Graph API error (${res.status}): ${err}`);
}

/**
 * Ensures each path segment exists under drive root (create-or-select).
 */
async function ensureFolderPath(
  accessToken: string,
  siteId: string,
  segments: string[],
): Promise<DriveItem> {
  let last: DriveItem | null = await getDriveItemByPath(
    accessToken,
    siteId,
    segments,
  );
  if (last?.id && last.webUrl) return last;

  const built: string[] = [];
  for (const segment of segments) {
    const existing = await getDriveItemByPath(accessToken, siteId, [
      ...built,
      segment,
    ]);
    if (existing?.id) {
      last = existing;
    } else {
      last = await createChildFolder(accessToken, siteId, built, segment);
    }
    built.push(segment);
  }

  if (!last?.id || !last.webUrl) {
    throw new Error("SharePoint folder ensure returned an incomplete drive item");
  }
  return last;
}

export type SharePointUploadedFile = {
  itemId: string;
  webUrl: string;
  name: string;
};

/**
 * Upload (or replace) a file into an existing drive folder by folder item id.
 * SharePoint Online remains the document source of truth.
 */
export async function uploadFileToSharePointFolder(input: {
  accessToken: string;
  siteId: string;
  folderId: string;
  fileName: string;
  contentType?: string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
}): Promise<SharePointUploadedFile> {
  const { accessToken, siteId, folderId } = input;
  if (!accessToken?.trim()) throw new Error("Graph access token is required");
  if (!siteId?.trim()) throw new Error("SHAREPOINT_SITE_ID is required");
  if (!folderId?.trim()) throw new Error("SharePoint folder id is required");

  const safeName = sanitizeSharePointName(input.fileName).replace(/\s+/g, " ");
  const path = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(safeName)}:/content`;

  const body =
    input.bytes instanceof Buffer
      ? input.bytes
      : Buffer.from(
          input.bytes instanceof ArrayBuffer
            ? new Uint8Array(input.bytes)
            : input.bytes,
        );

  const res = await fetch(path, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": input.contentType || "application/octet-stream",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph upload failed (${res.status}): ${err}`);
  }

  const item = (await res.json()) as DriveItem & { id?: string; webUrl?: string };
  if (!item.id || !item.webUrl) {
    throw new Error("Graph upload returned an incomplete drive item");
  }

  return {
    itemId: item.id,
    webUrl: item.webUrl,
    name: item.name ?? safeName,
  };
}

/**
 * Ensures hierarchical SharePoint folder:
 * /Opportunities/{CompanyName}/{OpportunityTitle}
 */
export async function ensureOpportunitySharePointFolder(
  accessToken: string,
  siteId: string,
  companyName: string,
  opportunityTitle: string,
): Promise<OpportunitySharePointFolder> {
  if (!accessToken?.trim()) {
    throw new Error("Graph access token is required to ensure opportunity folder");
  }
  if (!siteId?.trim()) {
    throw new Error("SHAREPOINT_SITE_ID is required to ensure opportunity folder");
  }

  const safeCompany = sanitizeSharePointName(companyName || "General Clients");
  const safeTitle = sanitizeSharePointName(opportunityTitle);
  const segments = ["Opportunities", safeCompany, safeTitle];
  const path = segments.join("/");

  try {
    const item = await ensureFolderPath(accessToken, siteId, segments);
    return {
      folderId: item.id!,
      webUrl: item.webUrl!,
      name: item.name ?? safeTitle,
      path,
    };
  } catch (error) {
    console.error(
      "[SharePoint Graph Error]: Failed to ensure opportunity folder",
      { path, error },
    );
    throw error;
  }
}
