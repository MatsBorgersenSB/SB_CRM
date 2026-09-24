import {
  SMARTDOC_CATEGORIES,
  SMARTDOC_TYPES,
} from "@/types/smartdoc-library";

/**
 * Microsoft Graph helpers for SharePoint Online document provisioning.
 * SharePoint Online is the single source of truth for opportunity documents.
 *
 * Hierarchy:
 *   /Opportunities/{CompanyName}/{OpportunityTitle}
 *   /Companies/{CompanyName}/Documents
 *   /Projects/{ProjectName}  (or /Projects/{CompanyName}/{ProjectName})
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

/** Classification written onto the SharePoint document library item. */
export type SmartDocSharePointFields = {
  DocCategory: string;
  DocType: string;
};

type GraphColumn = {
  id?: string;
  name?: string;
  displayName?: string;
  hidden?: boolean;
  readOnly?: boolean;
  text?: { allowMultipleLines?: boolean; maxLength?: number };
  choice?: {
    allowText?: boolean;
    choices?: string[];
    displayAs?: string;
  };
};

type ResolvedSmartDocColumns = {
  categoryName: string;
  typeName: string;
  categoryColumn: GraphColumn;
  typeColumn: GraphColumn;
};

const SMARTDOC_TYPE_LABELS = [...SMARTDOC_TYPES];

const resolvedSmartDocColumns = new Map<string, ResolvedSmartDocColumns>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeColumnKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

function columnChoices(column: GraphColumn): string[] {
  return (column.choice?.choices ?? [])
    .map((choice) => choice.trim())
    .filter(Boolean);
}

function isWritableColumn(column: GraphColumn): boolean {
  if (column.hidden || column.readOnly) return false;
  if (column.text || column.choice) return true;
  return Boolean(column.name);
}

function findColumn(
  columns: GraphColumn[],
  names: string[],
  displayNames: string[],
): GraphColumn | undefined {
  const nameKeys = names.map(normalizeColumnKey);
  const displayKeys = displayNames.map(normalizeColumnKey);
  return columns.find((column) => {
    if (!isWritableColumn(column)) return false;
    const name = normalizeColumnKey(column.name);
    const display = normalizeColumnKey(column.displayName);
    return nameKeys.includes(name) || displayKeys.includes(display);
  });
}

function findSmartDocCategoryColumn(columns: GraphColumn[]): GraphColumn | undefined {
  const owned = findColumn(
    columns,
    ["DocCategory", "Doc_Category", "DocCat"],
    ["Doc Category", "DocCategory", "Doc_Category", "Category"],
  );
  if (owned) return owned;

  const generic = findColumn(columns, ["Category"], ["Category"]);
  if (!generic?.choice) return undefined;
  const known = new Set(SMARTDOC_CATEGORIES.map((value) => value.toLowerCase()));
  const overlap = columnChoices(generic).some((choice) =>
    known.has(choice.toLowerCase()),
  );
  return overlap ? generic : undefined;
}

function findSmartDocTypeColumn(columns: GraphColumn[]): GraphColumn | undefined {
  const owned = findColumn(
    columns,
    ["DocType", "Doc_Types", "Doc_Type"],
    ["Doc Type", "DocType", "Doc Types", "Document Type"],
  );
  if (owned) return owned;

  const documentType = findColumn(
    columns,
    ["DocumentType"],
    ["Document Type"],
  );
  if (!documentType) return undefined;
  if (!documentType.choice) return documentType;
  const known = new Set(SMARTDOC_TYPE_LABELS.map((value) => value.toLowerCase()));
  const overlap = columnChoices(documentType).some((choice) =>
    known.has(choice.toLowerCase()),
  );
  return overlap ? documentType : undefined;
}

async function listDriveColumns(
  accessToken: string,
  siteId: string,
): Promise<GraphColumn[]> {
  const columns: GraphColumn[] = [];
  let endpoint: string | null =
    `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/columns?$top=200`;

  while (endpoint) {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Graph list columns failed (${res.status}): ${err}`);
    }
    const body = (await res.json()) as {
      value?: GraphColumn[];
      "@odata.nextLink"?: string;
    };
    columns.push(...(body.value ?? []));
    endpoint = body["@odata.nextLink"] ?? null;
  }

  return columns;
}

async function createDriveColumn(
  accessToken: string,
  siteId: string,
  name: string,
  displayName: string,
  choices: string[],
): Promise<GraphColumn> {
  const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/columns`;
  const choiceRes = await fetch(endpoint, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      name,
      displayName,
      hidden: false,
      required: false,
      choice: {
        allowText: true,
        choices,
        displayAs: "dropDownMenu",
      },
    }),
  });
  if (choiceRes.ok) return (await choiceRes.json()) as GraphColumn;

  const choiceErr = await choiceRes.text();
  if (
    choiceRes.status === 409 ||
    /already exists|nameAlreadyExists/i.test(choiceErr)
  ) {
    const existing = (await listDriveColumns(accessToken, siteId)).find(
      (column) => normalizeColumnKey(column.name) === normalizeColumnKey(name),
    );
    if (existing) return existing;
  }

  const textRes = await fetch(endpoint, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      name,
      displayName,
      hidden: false,
      required: false,
      text: { allowMultipleLines: false, maxLength: 255 },
    }),
  });
  if (textRes.ok) return (await textRes.json()) as GraphColumn;
  const textErr = await textRes.text();
  if (textRes.status === 409 || /already exists|nameAlreadyExists/i.test(textErr)) {
    const existing = (await listDriveColumns(accessToken, siteId)).find(
      (column) => normalizeColumnKey(column.name) === normalizeColumnKey(name),
    );
    if (existing) return existing;
  }
  throw new Error(
    `Graph create column ${name} failed (${textRes.status}): ${textErr || choiceErr}`,
  );
}

async function ensureChoiceOptions(
  accessToken: string,
  siteId: string,
  column: GraphColumn,
  required: string[],
): Promise<GraphColumn> {
  if (!column.id || !column.choice) return column;
  const existing = columnChoices(column);
  const merged = [...existing];
  for (const value of required) {
    if (!merged.some((choice) => choice.toLowerCase() === value.toLowerCase())) {
      merged.push(value);
    }
  }
  if (merged.length === existing.length && column.choice.allowText) return column;

  const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/columns/${encodeURIComponent(column.id)}`;
  const payload = {
    choice: {
      allowText: true,
      choices: merged,
      displayAs: column.choice.displayAs ?? "dropDownMenu",
    },
  };
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    return { ...column, choice: payload.choice };
  }
  const err = await res.text();
  if (/allowText|fill.?in/i.test(err) && merged.length !== existing.length) {
    const retry = await fetch(endpoint, {
      method: "PATCH",
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        choice: {
          choices: merged,
          displayAs: column.choice.displayAs ?? "dropDownMenu",
        },
      }),
    });
    if (retry.ok) {
      return {
        ...column,
        choice: { ...column.choice, choices: merged },
      };
    }
  }
  throw new Error(
    `Graph update column ${column.name} failed (${res.status}): ${err}`,
  );
}

async function addColumnToDocumentContentTypes(
  accessToken: string,
  siteId: string,
  column: GraphColumn,
): Promise<void> {
  if (!column.id) return;

  const typesRes = await fetch(
    `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/contentTypes?$select=id,name,hidden`,
    { method: "GET", headers: authHeaders(accessToken) },
  );
  if (!typesRes.ok) return;
  const typesBody = (await typesRes.json()) as {
    value?: Array<{ id?: string; name?: string; hidden?: boolean }>;
  };
  const targets = (typesBody.value ?? []).filter((type) => {
    if (!type.id || type.hidden) return false;
    const name = (type.name ?? "").trim().toLowerCase();
    return (
      name === "document" ||
      name === "item" ||
      name.endsWith(" document") ||
      name === "document set"
    );
  });

  const bindUrl = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/columns/${encodeURIComponent(column.id)}`;
  for (const type of targets) {
    const res = await fetch(
      `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/contentTypes/${encodeURIComponent(type.id!)}/columns`,
      {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({
          "sourceColumn@odata.bind": bindUrl,
        }),
      },
    );
    if (res.ok || res.status === 409) continue;
    const err = await res.text();
    if (/already exists|nameAlreadyExists/i.test(err)) continue;
  }
}

async function addColumnsToDefaultView(
  accessToken: string,
  siteId: string,
  columns: GraphColumn[],
): Promise<void> {
  const viewsRes = await fetch(
    `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/views`,
    { method: "GET", headers: authHeaders(accessToken) },
  );
  if (!viewsRes.ok) return;
  const viewsBody = (await viewsRes.json()) as {
    value?: Array<{ id?: string; name?: string; default?: boolean }>;
  };
  const view =
    (viewsBody.value ?? []).find((item) => item.default) ??
    (viewsBody.value ?? []).find(
      (item) => (item.name ?? "").toLowerCase() === "all documents",
    );
  if (!view?.id) return;

  for (const column of columns) {
    const name = column.name?.trim();
    if (!name) continue;
    const res = await fetch(
      `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/list/views/${encodeURIComponent(view.id)}/columns`,
      {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({ name }),
      },
    );
    if (res.ok || res.status === 404 || res.status === 405 || res.status === 409) {
      continue;
    }
    const err = await res.text();
    if (/already exists|nameAlreadyExists/i.test(err)) continue;
  }
}

async function resolveSmartDocLibraryColumns(
  accessToken: string,
  siteId: string,
  force = false,
): Promise<ResolvedSmartDocColumns> {
  if (!force) {
    const cached = resolvedSmartDocColumns.get(siteId);
    if (cached) return cached;
  }

  let columns = await listDriveColumns(accessToken, siteId);
  let categoryColumn = findSmartDocCategoryColumn(columns);
  let typeColumn = findSmartDocTypeColumn(columns);

  if (!categoryColumn) {
    await createDriveColumn(
      accessToken,
      siteId,
      "DocCategory",
      "Doc Category",
      [...SMARTDOC_CATEGORIES],
    );
    columns = await listDriveColumns(accessToken, siteId);
    categoryColumn = findSmartDocCategoryColumn(columns);
  }
  if (!typeColumn) {
    await createDriveColumn(
      accessToken,
      siteId,
      "DocType",
      "Doc Type",
      SMARTDOC_TYPE_LABELS,
    );
    columns = await listDriveColumns(accessToken, siteId);
    typeColumn = findSmartDocTypeColumn(columns);
  }

  if (!categoryColumn || !typeColumn) {
    throw new Error("SharePoint Doc Category / Doc Type columns could not be created");
  }

  categoryColumn = await ensureChoiceOptions(
    accessToken,
    siteId,
    categoryColumn,
    [...SMARTDOC_CATEGORIES],
  );
  typeColumn = await ensureChoiceOptions(
    accessToken,
    siteId,
    typeColumn,
    SMARTDOC_TYPE_LABELS,
  );

  await addColumnToDocumentContentTypes(accessToken, siteId, categoryColumn);
  await addColumnToDocumentContentTypes(accessToken, siteId, typeColumn);
  await addColumnsToDefaultView(accessToken, siteId, [categoryColumn, typeColumn]);

  const categoryName = categoryColumn.name?.trim();
  const typeName = typeColumn.name?.trim();
  if (!categoryName || !typeName) {
    throw new Error("SharePoint Doc Category / Doc Type columns have no internal name");
  }

  const resolved: ResolvedSmartDocColumns = {
    categoryName,
    typeName,
    categoryColumn,
    typeColumn,
  };
  resolvedSmartDocColumns.set(siteId, resolved);
  return resolved;
}

async function waitForDriveListItem(
  accessToken: string,
  siteId: string,
  itemId: string,
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(itemId)}/listItem`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: authHeaders(accessToken),
    });
    if (res.ok) return;
    const err = await res.text();
    lastError = new Error(`Graph listItem not ready (${res.status}): ${err}`);
    if (res.status !== 404 && !/not found|listItem/i.test(err)) {
      throw lastError;
    }
    await delay(400 * (attempt + 1));
  }
  if (lastError) throw lastError;
}

function pickExistingChoice(
  column: GraphColumn,
  desired: string,
  aliases: string[] = [],
): string {
  const options = columnChoices(column);
  if (options.length === 0) return desired;
  const candidates = [desired, ...aliases];
  for (const candidate of candidates) {
    const hit = options.find(
      (choice) => choice.toLowerCase() === candidate.toLowerCase(),
    );
    if (hit) return hit;
  }
  return desired;
}

async function patchDriveItemFields(
  accessToken: string,
  siteId: string,
  itemId: string,
  columns: ResolvedSmartDocColumns,
  fields: SmartDocSharePointFields,
): Promise<void> {
  const category = pickExistingChoice(columns.categoryColumn, fields.DocCategory, [
    "Leagal",
    "Financial",
    "Operational",
    "Commercial",
    "Technical",
    "Permits",
  ]);
  const type = pickExistingChoice(columns.typeColumn, fields.DocType, [
    "Quaotation",
    "Minutes of Meeting",
    "Meeting Notes",
  ]);
  const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(itemId)}/listItem/fields`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      [columns.categoryName]: category,
      [columns.typeName]: type,
    }),
  });
  if (res.ok) return;
  const err = await res.text();
  throw new Error(`Graph field patch failed (${res.status}): ${err}`);
}

/**
 * Write SmartDoc category and type onto the SharePoint library item
 * so the document library details pane and filters show the confirmed classification.
 */
export async function applySmartDocFieldsToDriveItem(input: {
  accessToken: string;
  siteId: string;
  itemId: string;
  fields: SmartDocSharePointFields;
}): Promise<void> {
  const category = input.fields.DocCategory.trim();
  const type = input.fields.DocType.trim();
  if (!category || !type) return;

  await waitForDriveListItem(input.accessToken, input.siteId, input.itemId);

  const write = async (forceResolve: boolean) => {
    const columns = await resolveSmartDocLibraryColumns(
      input.accessToken,
      input.siteId,
      forceResolve,
    );
    await patchDriveItemFields(
      input.accessToken,
      input.siteId,
      input.itemId,
      columns,
      { DocCategory: category, DocType: type },
    );
  };

  try {
    await write(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable =
      /404|not found|listItem|does not exist|invalid field|field or property|specified value is not valid/i.test(
        message,
      );
    if (!retryable) throw error;
    resolvedSmartDocColumns.delete(input.siteId);
    await delay(600);
    await waitForDriveListItem(input.accessToken, input.siteId, input.itemId);
    await write(true);
  }
}

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
  fields?: SmartDocSharePointFields;
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

  if (input.fields) {
    try {
      await applySmartDocFieldsToDriveItem({
        accessToken,
        siteId,
        itemId: item.id,
        fields: input.fields,
      });
    } catch (error) {
      console.warn(
        "[SharePoint] File uploaded but Doc Category / Doc Type were not written:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    itemId: item.id,
    webUrl: item.webUrl,
    name: item.name ?? safeName,
  };
}

export type SharePointUploadSession = {
  uploadUrl: string;
  expirationDateTime: string;
  fileName: string;
};

export type SharePointUploadChunkResult = {
  complete: boolean;
  item?: SharePointUploadedFile;
  nextExpectedRanges?: string[];
};

/**
 * Graph upload-session URLs are pre-authenticated. Only Microsoft hosts are allowed
 * so the chunk proxy cannot be used as an open SSRF relay.
 */
export function isTrustedSharePointUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "graph.microsoft.com" ||
      host.endsWith(".graph.microsoft.com") ||
      host.endsWith(".sharepoint.com") ||
      host.endsWith(".sharepoint-df.com") ||
      host.endsWith(".office.com") ||
      host.endsWith(".office365.com")
    );
  } catch {
    return false;
  }
}

/**
 * Create a resumable Graph upload session so the browser can send bytes
 * to SharePoint without putting the file through a Vercel function body.
 */
export async function createSharePointFolderUploadSession(input: {
  accessToken: string;
  siteId: string;
  folderId: string;
  fileName: string;
}): Promise<SharePointUploadSession> {
  const { accessToken, siteId, folderId } = input;
  if (!accessToken?.trim()) throw new Error("Graph access token is required");
  if (!siteId?.trim()) throw new Error("SHAREPOINT_SITE_ID is required");
  if (!folderId?.trim()) throw new Error("SharePoint folder id is required");

  const safeName = sanitizeSharePointName(input.fileName).replace(/\s+/g, " ");
  const path = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(safeName)}:/createUploadSession`;

  const res = await fetch(path, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
        name: safeName,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph createUploadSession failed (${res.status}): ${err}`);
  }

  const session = (await res.json()) as {
    uploadUrl?: string;
    expirationDateTime?: string;
  };
  if (!session.uploadUrl?.trim()) {
    throw new Error("Graph createUploadSession returned no uploadUrl");
  }
  if (!isTrustedSharePointUploadUrl(session.uploadUrl)) {
    throw new Error("Graph createUploadSession returned an untrusted upload URL");
  }

  return {
    uploadUrl: session.uploadUrl,
    expirationDateTime: session.expirationDateTime ?? "",
    fileName: safeName,
  };
}

/**
 * Forward one byte range to a Graph upload session. Last range returns the drive item.
 */
export async function putSharePointUploadSessionChunk(input: {
  uploadUrl: string;
  contentRange: string;
  bytes: ArrayBuffer | Uint8Array | Buffer;
}): Promise<SharePointUploadChunkResult> {
  if (!isTrustedSharePointUploadUrl(input.uploadUrl)) {
    throw new Error("Upload URL is not a trusted SharePoint host");
  }

  const body =
    input.bytes instanceof Buffer
      ? input.bytes
      : Buffer.from(
          input.bytes instanceof ArrayBuffer
            ? new Uint8Array(input.bytes)
            : input.bytes,
        );

  const res = await fetch(input.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(body.length),
      "Content-Range": input.contentRange,
      "Content-Type": "application/octet-stream",
    },
    body,
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Graph upload session chunk failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  if (!raw.trim()) {
    return { complete: false };
  }

  let parsed: {
    id?: string;
    webUrl?: string;
    name?: string;
    nextExpectedRanges?: string[];
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { complete: false };
  }

  if (parsed.id && parsed.webUrl) {
    return {
      complete: true,
      item: {
        itemId: parsed.id,
        webUrl: parsed.webUrl,
        name: parsed.name ?? "",
      },
    };
  }

  return {
    complete: false,
    nextExpectedRanges: parsed.nextExpectedRanges,
  };
}

/**
 * Delete a filed SmartDoc from the SharePoint document library.
 * Missing items are treated as already gone.
 */
export async function deleteSharePointDriveItem(input: {
  accessToken: string;
  siteId: string;
  itemId: string;
}): Promise<void> {
  if (!input.accessToken?.trim()) throw new Error("Graph access token is required");
  if (!input.siteId?.trim()) throw new Error("SHAREPOINT_SITE_ID is required");
  if (!input.itemId?.trim()) return;

  const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(input.siteId)}/drive/items/${encodeURIComponent(input.itemId)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: authHeaders(input.accessToken),
  });
  if (res.ok || res.status === 204 || res.status === 404) return;
  const err = await res.text();
  throw new Error(`Graph delete failed (${res.status}): ${err}`);
}

/**
 * Download file bytes from a SharePoint drive item so SmartAssist can read content.
 */
export async function downloadSharePointDriveItemBytes(input: {
  accessToken: string;
  siteId: string;
  itemId: string;
}): Promise<Buffer> {
  if (!input.accessToken?.trim()) throw new Error("Graph access token is required");
  if (!input.siteId?.trim()) throw new Error("SHAREPOINT_SITE_ID is required");
  if (!input.itemId?.trim()) throw new Error("SharePoint item id is required");

  const endpoint = `${GRAPH_BASE}/sites/${encodeURIComponent(input.siteId)}/drive/items/${encodeURIComponent(input.itemId)}/content`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/octet-stream",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph download failed (${res.status}): ${err}`);
  }
  return Buffer.from(await res.arrayBuffer());
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

export type CompanyDocumentsSharePointFolder = {
  folderId: string;
  webUrl: string;
  name: string;
  /** Drive-relative path, e.g. Companies/DorsetGM/Documents */
  path: string;
};

/**
 * Ensures company documents folder (FS-006):
 * /Companies/{CompanyName}/Documents
 *
 * TODO(FS-006 Phase 2): persist folder id on Company registry (mirror opportunity).
 */
export async function ensureCompanyDocumentsSharePointFolder(
  accessToken: string,
  siteId: string,
  companyName: string,
): Promise<CompanyDocumentsSharePointFolder> {
  if (!accessToken?.trim()) {
    throw new Error("Graph access token is required to ensure company Documents folder");
  }
  if (!siteId?.trim()) {
    throw new Error("SHAREPOINT_SITE_ID is required to ensure company Documents folder");
  }

  const safeCompany = sanitizeSharePointName(companyName || "Unknown Company");
  const segments = ["Companies", safeCompany, "Documents"];
  const path = segments.join("/");

  try {
    const item = await ensureFolderPath(accessToken, siteId, segments);
    return {
      folderId: item.id!,
      webUrl: item.webUrl!,
      name: item.name ?? "Documents",
      path,
    };
  } catch (error) {
    console.error(
      "[SharePoint Graph Error]: Failed to ensure company Documents folder",
      { path, error },
    );
    throw error;
  }
}

export type ProjectSharePointFolder = {
  folderId: string;
  webUrl: string;
  name: string;
  /** Drive-relative path, e.g. Projects/Bio4Metal or Projects/Acme/Bio4Metal */
  path: string;
};

/**
 * Ensures hierarchical SharePoint folder for a project:
 * /Projects/{ProjectName}
 * or, when a company is linked: /Projects/{CompanyName}/{ProjectName}
 *
 * Creates the root `Projects` folder on first use (mirrors Opportunities / Companies).
 */
export async function ensureProjectSharePointFolder(
  accessToken: string,
  siteId: string,
  projectName: string,
  companyName?: string | null,
): Promise<ProjectSharePointFolder> {
  if (!accessToken?.trim()) {
    throw new Error("Graph access token is required to ensure project folder");
  }
  if (!siteId?.trim()) {
    throw new Error("SHAREPOINT_SITE_ID is required to ensure project folder");
  }

  const safeProject = sanitizeSharePointName(projectName || "Untitled Project");
  const safeCompany = companyName?.trim()
    ? sanitizeSharePointName(companyName)
    : null;
  const segments = safeCompany
    ? ["Projects", safeCompany, safeProject]
    : ["Projects", safeProject];
  const path = segments.join("/");

  try {
    const item = await ensureFolderPath(accessToken, siteId, segments);
    return {
      folderId: item.id!,
      webUrl: item.webUrl!,
      name: item.name ?? safeProject,
      path,
    };
  } catch (error) {
    console.error(
      "[SharePoint Graph Error]: Failed to ensure project folder",
      { path, error },
    );
    throw error;
  }
}
