import { getPrisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/encryption";
import {
  getAzureAdClientId,
  getAzureAdClientSecret,
  getAzureAdTenantId,
} from "@/lib/auth-env";

const GRAPH_BASE =
  process.env.MICROSOFT_GRAPH_BASE_URL?.replace(/\/$/, "") ||
  "https://graph.microsoft.com/v1.0";

/** Microsoft Graph mail/calendar subscription max lifetime ≈ 4230 minutes (≈ 3 days). */
export const M365_SUBSCRIPTION_RENEWAL_MINUTES = 4230;

/**
 * Delegated Graph scopes for Outlook + SharePoint document backend.
 * Override with M365_OAUTH_SCOPES (space/comma separated) when needed.
 */
const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Mail.Send",
  "Calendars.Read",
  "Files.ReadWrite.All",
  "Sites.ReadWrite.All",
];

export const SMARTCRM_MASTER_CATEGORY = "SmartCRM";

export type M365TokenSet = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
  scope?: string | null;
  idToken?: string | null;
};

export type GraphMailMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string } }>;
  sentDateTime?: string;
  receivedDateTime?: string;
  categories?: string[];
  "@removed"?: { reason?: string };
};

export type MailDeltaPage = {
  value: GraphMailMessage[];
  deltaLink?: string;
  nextLink?: string;
};

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function m365RedirectUri(): string {
  return `${appBaseUrl()}/api/auth/m365/callback`;
}

export function m365OAuthScopes(): string[] {
  const raw = process.env.M365_OAUTH_SCOPES?.trim();
  if (!raw) return DEFAULT_SCOPES;
  return raw.split(/[\s,]+/).filter(Boolean);
}

function tenantId(): string {
  return getAzureAdTenantId() || "organizations";
}

function clientId(): string {
  const id = getAzureAdClientId();
  if (!id) throw new Error("AZURE_AD_CLIENT_ID is not configured");
  return id;
}

function clientSecret(): string {
  const secret = getAzureAdClientSecret();
  if (!secret) throw new Error("AZURE_AD_CLIENT_SECRET is not configured");
  return secret;
}

export function buildM365AuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: m365RedirectUri(),
    response_mode: "query",
    scope: m365OAuthScopes().join(" "),
    state,
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId())}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<M365TokenSet> {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId())}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        `Token exchange failed (${response.status})`,
    );
  }
  const expiresAt =
    typeof payload.expires_in === "number"
      ? new Date(Date.now() + payload.expires_in * 1000)
      : null;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt,
    scope: payload.scope ?? null,
    idToken: payload.id_token ?? null,
  };
}

export async function exchangeM365AuthCode(code: string): Promise<M365TokenSet> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "authorization_code",
    code,
    redirect_uri: m365RedirectUri(),
    scope: m365OAuthScopes().join(" "),
  });
  return tokenRequest(body);
}

export async function refreshM365AccessToken(refreshToken: string): Promise<M365TokenSet> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: m365OAuthScopes().join(" "),
  });
  return tokenRequest(body);
}

export async function graphRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${GRAPH_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: string };
  };
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.code ||
      `Graph request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function fetchGraphMe(accessToken: string): Promise<{
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
}> {
  return graphRequest(accessToken, "/me?$select=id,mail,userPrincipalName,displayName");
}

export async function ensureSmartCrmMasterCategory(accessToken: string): Promise<void> {
  const existing = await graphRequest<{
    value?: Array<{ displayName?: string }>;
  }>(accessToken, "/me/outlook/masterCategories");
  const hasSmartCrm = (existing.value ?? []).some(
    (category) => category.displayName?.toLowerCase() === SMARTCRM_MASTER_CATEGORY.toLowerCase(),
  );
  if (hasSmartCrm) return;

  await graphRequest(accessToken, "/me/outlook/masterCategories", {
    method: "POST",
    body: JSON.stringify({
      displayName: SMARTCRM_MASTER_CATEGORY,
      color: "preset0",
    }),
  });
}

export function buildOpportunityCategoryName(opportunityName: string): string {
  const sanitized = opportunityName.replace(/[^\w\s\-./]/g, "").trim().slice(0, 80);
  return `${SMARTCRM_MASTER_CATEGORY} / ${sanitized || "Opportunity"}`;
}

export async function applySmartCrmCategories(
  accessToken: string,
  externalMessageId: string,
  options?: { opportunityName?: string; existingCategories?: string[] },
): Promise<string> {
  await ensureSmartCrmMasterCategory(accessToken);

  const opportunityCategory = options?.opportunityName
    ? buildOpportunityCategoryName(options.opportunityName)
    : null;

  let current = options?.existingCategories;
  if (!current) {
    const message = await graphRequest<{ categories?: string[] }>(
      accessToken,
      `/me/messages/${encodeURIComponent(externalMessageId)}?$select=categories`,
    );
    current = message.categories ?? [];
  }

  const next = new Set(current);
  next.add(SMARTCRM_MASTER_CATEGORY);
  if (opportunityCategory) next.add(opportunityCategory);

  await graphRequest(accessToken, `/me/messages/${encodeURIComponent(externalMessageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ categories: [...next] }),
  });

  return opportunityCategory ?? SMARTCRM_MASTER_CATEGORY;
}

export async function fetchMailDelta(
  accessToken: string,
  deltaOrNextUrl?: string | null,
): Promise<MailDeltaPage> {
  const path =
    deltaOrNextUrl ||
    "/me/mailFolders/inbox/messages/delta?$select=id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,categories";

  const payload = await graphRequest<{
    value?: GraphMailMessage[];
    "@odata.nextLink"?: string;
    "@odata.deltaLink"?: string;
  }>(accessToken, path);

  return {
    value: payload.value ?? [],
    nextLink: payload["@odata.nextLink"],
    deltaLink: payload["@odata.deltaLink"],
  };
}

/** Extend a Graph change-notification subscription expiration (Gap 1). */
export async function renewGraphSubscription(
  accessToken: string,
  externalSubscriptionId: string,
  expiresAt: Date,
): Promise<{ id: string; expirationDateTime: string }> {
  return graphRequest(accessToken, `/subscriptions/${encodeURIComponent(externalSubscriptionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      expirationDateTime: expiresAt.toISOString(),
    }),
  });
}

/**
 * Persist or refresh the active M365 ExternalIntegration row after OAuth.
 * Access / refresh tokens are encrypted at rest (AES-256-GCM).
 */
export async function upsertM365ExternalIntegration(input: {
  tokens: M365TokenSet;
  tenantId?: string | null;
  userObjectId: string;
}): Promise<{ id: string; status: string }> {
  const prisma = getPrisma();
  const existing = await prisma.externalIntegration.findFirst({
    where: {
      provider: "m365_graph",
      userObjectId: input.userObjectId,
    },
  });

  const encryptedAccess = encryptToken(input.tokens.accessToken);
  const encryptedRefresh = input.tokens.refreshToken
    ? encryptToken(input.tokens.refreshToken)
    : existing?.refreshToken ?? null;

  const data = {
    provider: "m365_graph" as const,
    tenantId: input.tenantId ?? tenantId(),
    userObjectId: input.userObjectId,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    tokenExpiresAt: input.tokens.expiresAt,
    status: "active",
  };

  if (existing) {
    const updated = await prisma.externalIntegration.update({
      where: { id: existing.id },
      data,
    });
    return { id: updated.id, status: updated.status };
  }

  const created = await prisma.externalIntegration.create({ data });
  return { id: created.id, status: created.status };
}

/**
 * Resolve a usable access token for the active M365 integration (refresh if expired).
 * Decrypts tokens from Prisma before Graph / token endpoint use.
 */
export async function getActiveM365AccessToken(
  userObjectId?: string,
): Promise<{ accessToken: string; integrationId: string } | null> {
  const prisma = getPrisma();
  const integration = await prisma.externalIntegration.findFirst({
    where: {
      provider: "m365_graph",
      status: "active",
      ...(userObjectId ? { userObjectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!integration?.accessToken) return null;

  const accessToken = decryptToken(integration.accessToken);

  const expiresSoon =
    integration.tokenExpiresAt != null &&
    integration.tokenExpiresAt.getTime() < Date.now() + 60_000;

  if (!expiresSoon) {
    return { accessToken, integrationId: integration.id };
  }

  if (!integration.refreshToken) {
    await prisma.externalIntegration.update({
      where: { id: integration.id },
      data: { status: "error" },
    });
    return null;
  }

  const refreshToken = decryptToken(integration.refreshToken);
  const refreshed = await refreshM365AccessToken(refreshToken);
  await prisma.externalIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: encryptToken(refreshed.accessToken),
      refreshToken: refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : integration.refreshToken,
      tokenExpiresAt: refreshed.expiresAt,
      status: "active",
    },
  });

  return { accessToken: refreshed.accessToken, integrationId: integration.id };
}

/** Load a decrypted access token for a specific ExternalIntegration id. */
export async function getAccessTokenForIntegration(
  integrationId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const integration = await prisma.externalIntegration.findUnique({
    where: { id: integrationId },
  });
  if (!integration || integration.status !== "active" || !integration.accessToken) {
    return null;
  }

  const expiresSoon =
    integration.tokenExpiresAt != null &&
    integration.tokenExpiresAt.getTime() < Date.now() + 60_000;

  if (!expiresSoon) {
    return decryptToken(integration.accessToken);
  }

  const resolved = await getActiveM365AccessToken(integration.userObjectId ?? undefined);
  return resolved?.integrationId === integrationId ? resolved.accessToken : null;
}

const COMMERCIAL_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".png",
]);

export type M365AttachmentMeta = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes: string | null;
};

function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function isCommercialAttachment(name: string, isInline?: boolean): boolean {
  if (isInline) return false;
  return COMMERCIAL_ATTACHMENT_EXTENSIONS.has(fileExtension(name));
}

/**
 * Fetch message attachments from Graph; drop inline signature images;
 * keep commercial docs (.pdf, .docx, .xlsx, .pptx, .png).
 */
export async function fetchM365MessageAttachments(input: {
  integrationId: string;
  messageId: string;
}): Promise<M365AttachmentMeta[]> {
  const accessToken = await getAccessTokenForIntegration(input.integrationId);
  if (!accessToken) {
    throw new Error("No active M365 access token for integration");
  }

  const payload = await graphRequest<{
    value?: Array<{
      id?: string;
      name?: string;
      contentType?: string;
      size?: number;
      isInline?: boolean;
      contentBytes?: string;
      "@odata.type"?: string;
    }>;
  }>(
    accessToken,
    `/me/messages/${encodeURIComponent(input.messageId)}/attachments`,
  );

  return (payload.value ?? [])
    .filter((item) => {
      if (!item.id || !item.name) return false;
      // File attachments only (skip itemAttachment / referenceAttachment without bytes).
      if (
        item["@odata.type"] &&
        !item["@odata.type"].toLowerCase().includes("fileattachment")
      ) {
        return false;
      }
      return isCommercialAttachment(item.name, item.isInline);
    })
    .map((item) => ({
      id: item.id!,
      name: item.name!,
      contentType: item.contentType ?? "application/octet-stream",
      size: typeof item.size === "number" ? item.size : 0,
      contentBytes: item.contentBytes ?? null,
    }));
}

export type CreateM365DraftInput = {
  integrationId: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
};

export type CreateM365DraftResult = {
  draftId: string;
  webLink: string | null;
};

/**
 * Create a draft message in the connected mailbox Drafts folder.
 * Uses Graph `POST /me/messages` (creates a draft; Graph has no `/me/createMessage`).
 */
export async function createM365DraftEmail(
  input: CreateM365DraftInput,
): Promise<CreateM365DraftResult> {
  const accessToken = await getAccessTokenForIntegration(input.integrationId);
  if (!accessToken) {
    throw new Error("No active M365 access token for integration");
  }

  const created = await graphRequest<{
    id?: string;
    webLink?: string;
  }>(accessToken, "/me/messages", {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: {
        contentType: "HTML",
        content: input.bodyHtml,
      },
      toRecipients: [
        {
          emailAddress: {
            address: input.toEmail,
          },
        },
      ],
    }),
  });

  if (!created?.id) {
    throw new Error("Graph did not return a draft message id");
  }

  return {
    draftId: created.id,
    webLink: created.webLink ?? null,
  };
}

/**
 * Outlook on the web compose deep link (no Graph / no add-in required).
 */
export function generateOutlookDeepLink(input: {
  toEmail: string;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams();
  params.set("to", input.toEmail);
  params.set("subject", input.subject);
  // Outlook compose expects CRLF line breaks in body.
  params.set("body", input.body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
  // URLSearchParams uses + for spaces; Outlook prefers %20.
  const query = params
    .toString()
    .replace(/\+/g, "%20");
  return `https://outlook.office.com/mail/deeplink/compose?${query}`;
}
