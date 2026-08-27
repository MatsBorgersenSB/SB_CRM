/**
 * Outlook sender resolution — email, display name, and dev query-param fallbacks.
 */

import { extractEmailDomain } from "@/lib/domain-rules";
import { whenOfficeReady } from "@/lib/outlook-office";
import { resolvePublicAppOrigin } from "@/lib/smartcrm-origin";
import { buildOutlookReadDeeplink } from "@/lib/m365/outlook-deeplink";
import {
  isMailboxOwnerEmail,
  isUsableCounterpartyEmail,
  pickOutlookCounterparty,
} from "@/lib/m365/outlook-counterparty";

export type OutlookSenderDetails = {
  email: string;
  displayName: string;
};

const AUTOMATED_MAIL_DOMAINS = new Set([
  "adobesign.com",
  "echosign.com",
  "docusign.com",
  "docusign.net",
]);

export function isAutomatedMailboxEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const domain = extractEmailDomain(normalized);
  if (
    AUTOMATED_MAIL_DOMAINS.has(domain) ||
    domain.endsWith(".adobesign.com") ||
    domain.endsWith(".docusign.net")
  ) {
    return true;
  }
  const local = normalized.slice(0, Math.max(0, normalized.indexOf("@")));
  return /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|notifications?)$/i.test(
    local,
  );
}

function mailboxSelfEmails(mailbox: Office.Mailbox | undefined): string[] {
  const emails: string[] = [];
  const profile = mailbox?.userProfile?.emailAddress?.trim().toLowerCase();
  if (profile) emails.push(profile);
  return emails;
}

function bumpCounterpartyCount(
  counts: Map<string, { count: number; displayName: string }>,
  email: string,
  displayName: string,
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const previous = counts.get(normalized);
  counts.set(normalized, {
    count: (previous?.count ?? 0) + 1,
    displayName: previous?.displayName || displayName.trim(),
  });
}

function pickBestCounterpartyFromSeeds(
  seeds: OutlookOpenMessageSeed[],
  selfEmails: readonly string[],
): OutlookSenderDetails | null {
  const counts = new Map<string, { count: number; displayName: string }>();
  for (const seed of seeds) {
    const sender = seed.senderEmail.trim().toLowerCase();
    if (isUsableCounterpartyEmail(sender, selfEmails)) {
      bumpCounterpartyCount(counts, sender, seed.senderDisplayName || "");
    }
    for (const recipient of seed.recipientEmails ?? []) {
      if (isUsableCounterpartyEmail(recipient, selfEmails)) {
        bumpCounterpartyCount(counts, recipient, "");
      }
    }
  }

  let best: { email: string; count: number; displayName: string } | null = null;
  for (const [email, row] of counts) {
    if (!best || row.count > best.count) {
      best = { email, count: row.count, displayName: row.displayName };
    }
  }
  if (!best) return null;
  return { email: best.email, displayName: best.displayName };
}

export async function resolveOutlookSenderDetails(): Promise<OutlookSenderDetails | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const office = await whenOfficeReady();
  if (!office) return null;

  try {
    const mailbox = office.context.mailbox;
    const item = mailbox?.item;
    const selfEmails = mailboxSelfEmails(mailbox);

    // Multi-select: mailbox.item is the last opened mail (often Adobe Sign),
    // not the checked set. Always resolve from the selection.
    const selectedSeeds = await resolveOutlookSelectedMessageSeeds();
    if (selectedSeeds.length > 1) {
      const fromSeeds = pickBestCounterpartyFromSeeds(selectedSeeds, selfEmails);
      if (fromSeeds) return fromSeeds;
    }

    const fromEmail = item?.from?.emailAddress?.trim().toLowerCase() ?? "";
    const senderEmail =
      (
        item as { sender?: { emailAddress?: string; displayName?: string } } | undefined
      )?.sender?.emailAddress?.trim().toLowerCase() ?? "";
    const fromIsSelfOrInternal =
      Boolean(fromEmail) && !isUsableCounterpartyEmail(fromEmail, selfEmails);

    const recipients = await resolveOutlookReadRecipients({
      attempts: fromIsSelfOrInternal || !fromEmail ? 6 : 3,
      delayMs: fromIsSelfOrInternal || !fromEmail ? 350 : 250,
    });

    const picked = pickOutlookCounterparty({
      from: fromEmail
        ? { email: fromEmail, displayName: item?.from?.displayName?.trim() ?? "" }
        : null,
      sender: senderEmail
        ? {
            email: senderEmail,
            displayName:
              (
                item as { sender?: { displayName?: string } } | undefined
              )?.sender?.displayName?.trim() ?? "",
          }
        : null,
      recipients,
      selfEmails,
    });
    if (picked) {
      return { email: picked.email, displayName: picked.displayName ?? "" };
    }

    return pickBestCounterpartyFromSeeds(selectedSeeds, selfEmails);
  } catch {
    return null;
  }
}

export async function resolveOutlookCounterpartyEmail(): Promise<string | null> {
  const sender = await resolveOutlookSenderDetails();
  return sender?.email ?? null;
}

/**
 * Graph conversationId for the open Outlook item (read or compose), when available.
 */
export async function resolveOutlookConversationId(): Promise<string | null> {
  const seed = await resolveOutlookOpenMessageSeed();
  return seed?.conversationId ?? null;
}

export type OutlookOpenMessageSeed = {
  conversationId: string;
  /** Prefer Graph REST item id when convertToRestId is available. */
  externalMessageId: string;
  subject: string;
  senderEmail: string;
  senderDisplayName?: string;
  sentAt: string;
  /** True when the open item is an outbound draft / send we are composing. */
  isOutbound?: boolean;
  recipientEmails?: string[];
  bodyPreview?: string;
  webLink?: string;
};

export type OutlookComposeRecipient = {
  email: string;
  displayName: string;
};

function isOfficeAsyncSuccess(status: unknown): boolean {
  if (status === "succeeded" || status === 0) return true;
  try {
    return status === Office?.AsyncResultStatus?.Succeeded;
  } catch {
    return false;
  }
}

function mapEmailAddressDetails(
  entries: Array<{ emailAddress?: string; displayName?: string }> | null | undefined,
): OutlookComposeRecipient[] {
  if (!entries?.length) return [];
  return entries
    .map((entry) => ({
      email: entry.emailAddress?.trim().toLowerCase() ?? "",
      displayName: entry.displayName?.trim() ?? "",
    }))
    .filter((entry) => Boolean(entry.email));
}

/**
 * Read To/Cc/Bcc from either:
 * - Message Read / Sent Items: synchronous EmailAddressDetails[]
 * - Message Compose: Recipients.getAsync(...)
 */
function getRecipientsAsync(source: unknown): Promise<OutlookComposeRecipient[]> {
  if (!source) return Promise.resolve([]);

  // Read mode (including Sent Items): item.to / item.cc are arrays.
  if (Array.isArray(source)) {
    return Promise.resolve(mapEmailAddressDetails(source));
  }

  const withGetAsync = source as {
    getAsync?: (
      callback: (result: Office.AsyncResult<Office.EmailAddressDetails[]>) => void,
    ) => void;
  };
  if (typeof withGetAsync.getAsync !== "function") {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    try {
      withGetAsync.getAsync!((result) => {
        if (!isOfficeAsyncSuccess(result.status) || !result.value) {
          resolve([]);
          return;
        }
        resolve(mapEmailAddressDetails(result.value));
      });
    } catch {
      resolve([]);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Subject is a string in read mode; in compose it is often a Subject object with getAsync.
 */
function coerceSubjectString(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "(no subject)";
  }
  return "(no subject)";
}

async function readOutlookItemSubject(item: {
  subject?: unknown;
}): Promise<string> {
  const subject = item.subject;
  if (typeof subject === "string") {
    return coerceSubjectString(subject);
  }
  if (
    subject &&
    typeof subject === "object" &&
    "getAsync" in subject &&
    typeof (subject as { getAsync?: unknown }).getAsync === "function"
  ) {
    const value = await new Promise<string>((resolve) => {
      try {
        (
          subject as {
            getAsync: (
              callback: (result: Office.AsyncResult<string>) => void,
            ) => void;
          }
        ).getAsync((result) => {
          if (!isOfficeAsyncSuccess(result.status) || result.value == null) {
            resolve("");
            return;
          }
          resolve(String(result.value).trim());
        });
      } catch {
        resolve("");
      }
    });
    return value || "(no subject)";
  }
  return "(no subject)";
}

/**
 * Resolve To (+ Cc/Bcc) on the open read or compose item.
 * Excludes the mailbox owner. Reality First — only addresses Outlook provides.
 * Retries briefly — Outlook for Mac often resolves recipients after the pane opens.
 */
export async function resolveOutlookReadRecipients(options?: {
  attempts?: number;
  delayMs?: number;
}): Promise<OutlookComposeRecipient[]> {
  if (typeof window === "undefined") return [];

  const office = await whenOfficeReady();
  if (!office) return [];

  const attempts = Math.max(1, options?.attempts ?? 5);
  const delayMs = Math.max(0, options?.delayMs ?? 400);

  try {
    const mailbox = office.context.mailbox;
    const item = mailbox?.item;
    if (!item) return [];

    const selfEmails = mailboxSelfEmails(mailbox);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const [to, cc, bcc] = await Promise.all([
        getRecipientsAsync(item.to),
        getRecipientsAsync(item.cc),
        getRecipientsAsync(item.bcc),
      ]);

      const seen = new Set<string>();
      const recipients: OutlookComposeRecipient[] = [];
      for (const entry of [...to, ...cc, ...bcc]) {
        if (!entry.email || seen.has(entry.email)) continue;
        if (isMailboxOwnerEmail(entry.email, selfEmails)) continue;
        seen.add(entry.email);
        recipients.push(entry);
      }

      if (recipients.length > 0) return recipients;
      if (attempt < attempts - 1) await sleep(delayMs);
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Resolve To (+ Cc/Bcc) recipients on a compose item.
 * Excludes the mailbox owner. Reality First — only addresses Outlook provides.
 * Retries briefly — New Outlook often resolves recipients after the pane opens.
 */
export async function resolveOutlookComposeRecipients(options?: {
  attempts?: number;
  delayMs?: number;
}): Promise<OutlookComposeRecipient[]> {
  if (typeof window === "undefined") return [];

  const office = await whenOfficeReady();
  if (!office) return [];

  return resolveOutlookReadRecipients(options);
}

/**
 * Subscribe to To/Cc/Bcc changes on the open compose item.
 * Returns an unsubscribe function (best-effort).
 */
export async function subscribeOutlookComposeRecipientsChanged(
  onChanged: () => void,
): Promise<() => void> {
  const office = await whenOfficeReady();
  const item = office?.context.mailbox?.item;
  if (!item?.addHandlerAsync) return () => undefined;

  const eventType =
    office?.EventType?.RecipientsChanged ??
    ("recipientsChanged" as Office.EventType);

  const handler = () => {
    onChanged();
  };

  await new Promise<void>((resolve) => {
    try {
      item.addHandlerAsync!(eventType, handler, () => resolve());
    } catch {
      resolve();
    }
  });

  return () => {
    try {
      item.removeHandlerAsync?.(eventType, { handler }, () => undefined);
    } catch {
      // ignore
    }
  };
}

async function saveComposeItemAsync(): Promise<boolean> {
  const office = await whenOfficeReady();
  const item = office?.context.mailbox?.item;
  if (!item?.saveAsync) return false;

  return await new Promise((resolve) => {
    item.saveAsync!((result) => {
      resolve(isOfficeAsyncSuccess(result.status));
    });
  });
}

/**
 * Ensure compose draft has itemId + conversationId (saveAsync when needed).
 * Returns null if Outlook cannot provide identity yet.
 */
export async function ensureOutlookComposeSeed(input?: {
  primaryRecipientEmail?: string;
}): Promise<OutlookOpenMessageSeed | null> {
  let seed = await resolveOutlookOpenMessageSeed({
    preferOutbound: true,
    primaryRecipientEmail: input?.primaryRecipientEmail,
  });
  if (seed) return seed;

  const saved = await saveComposeItemAsync();
  if (!saved) return null;

  // Brief pause so hosts populate itemId / conversationId after save.
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  seed = await resolveOutlookOpenMessageSeed({
    preferOutbound: true,
    primaryRecipientEmail: input?.primaryRecipientEmail,
  });
  return seed;
}

/**
 * Snapshot of the open Outlook item for intentional tagging when mail sync
 * has not yet ingested the conversation.
 */
export async function resolveOutlookOpenMessageSeed(options?: {
  preferOutbound?: boolean;
  primaryRecipientEmail?: string;
}): Promise<OutlookOpenMessageSeed | null> {
  const selected = await resolveOutlookSelectedMessageSeeds(options);
  return selected[0] ?? null;
}

type OutlookSelectedItemLite = {
  itemId?: string;
  conversationId?: string;
  subject?: string;
};

function mailboxSupports(office: typeof Office, version: string): boolean {
  try {
    const requirements = (
      office.context as { requirements?: { isSetSupported?: (set: string, v: string) => boolean } }
    ).requirements;
    return requirements?.isSetSupported?.("Mailbox", version) === true;
  } catch {
    return false;
  }
}

function convertToRestId(mailbox: Office.Mailbox, itemId: string): string {
  try {
    const convert = (
      mailbox as {
        convertToRestId?: (id: string, version: string) => string;
      }
    ).convertToRestId;
    if (typeof convert === "function") {
      const restId = convert.call(mailbox, itemId, "v2.0")?.trim();
      if (restId) return restId;
    }
  } catch {
    // Keep EWS id.
  }
  return itemId;
}

function getSelectedItemsLite(
  mailbox: Office.Mailbox,
): Promise<OutlookSelectedItemLite[]> {
  const getSelected = (
    mailbox as {
      getSelectedItemsAsync?: (
        callback: (result: Office.AsyncResult<OutlookSelectedItemLite[]>) => void,
      ) => void;
    }
  ).getSelectedItemsAsync;
  if (typeof getSelected !== "function") return Promise.resolve([]);

  return new Promise((resolve) => {
    try {
      getSelected.call(mailbox, (result) => {
        if (!isOfficeAsyncSuccess(result.status) || !result.value) {
          resolve([]);
          return;
        }
        resolve(result.value);
      });
    } catch {
      resolve([]);
    }
  });
}

type LoadedOutlookItem = {
  from?: { emailAddress?: string; displayName?: string };
  to?: {
    getAsync: (callback: (result: Office.AsyncResult<Office.EmailAddressDetails[]>) => void) => void;
  };
  cc?: {
    getAsync: (callback: (result: Office.AsyncResult<Office.EmailAddressDetails[]>) => void) => void;
  };
  subject?: string;
  conversationId?: string;
  itemId?: string;
  dateTimeCreated?: Date;
  body?: Office.MailboxItem["body"];
  getConversationIdAsync?: Office.MailboxItem["getConversationIdAsync"];
  unloadAsync?: (callback?: () => void) => void;
};

function loadMailboxItemById(
  mailbox: Office.Mailbox,
  itemId: string,
): Promise<LoadedOutlookItem | null> {
  const load = (
    mailbox as {
      loadItemByIdAsync?: (
        id: string,
        callback: (result: Office.AsyncResult<LoadedOutlookItem>) => void,
      ) => void;
    }
  ).loadItemByIdAsync;
  if (typeof load !== "function") return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      load.call(mailbox, itemId, (result) => {
        if (!isOfficeAsyncSuccess(result.status) || !result.value) {
          resolve(null);
          return;
        }
        resolve(result.value);
      });
    } catch {
      resolve(null);
    }
  });
}

function unloadMailboxItem(item: LoadedOutlookItem | null): Promise<void> {
  if (!item?.unloadAsync) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      item.unloadAsync!(() => resolve());
    } catch {
      resolve();
    }
  });
}

const MAX_SELECTED_MAILS = 50;

function seedFromSelectedLite(
  mailbox: Office.Mailbox,
  selected: OutlookSelectedItemLite,
): OutlookOpenMessageSeed | null {
  const conversationId = selected.conversationId?.trim() || "";
  const ewsOrRestId = selected.itemId?.trim() || "";
  if (!conversationId || !ewsOrRestId) return null;

  const externalMessageId = convertToRestId(mailbox, ewsOrRestId);
  return {
    conversationId,
    externalMessageId,
    subject: coerceSubjectString(selected.subject),
    senderEmail: "",
    sentAt: "",
    isOutbound: false,
    webLink: buildOutlookReadDeeplink(externalMessageId) ?? undefined,
  };
}

async function seedFromLoadedItem(
  mailbox: Office.Mailbox,
  office: typeof Office,
  item: LoadedOutlookItem,
  selected: OutlookSelectedItemLite,
  options?: { preferOutbound?: boolean; primaryRecipientEmail?: string },
): Promise<OutlookOpenMessageSeed | null> {
  let conversationId =
    item.conversationId?.trim() || selected.conversationId?.trim() || "";
  if (!conversationId && typeof item.getConversationIdAsync === "function") {
    conversationId = await new Promise<string>((resolve) => {
      item.getConversationIdAsync!((result) => {
        if (!isOfficeAsyncSuccess(result.status)) {
          resolve("");
          return;
        }
        resolve(result.value?.trim() || "");
      });
    });
  }
  const ewsOrRestId = item.itemId?.trim() || selected.itemId?.trim() || "";
  if (!conversationId || !ewsOrRestId) return null;

  const externalMessageId = convertToRestId(mailbox, ewsOrRestId);
  const created = item.dateTimeCreated
    ? new Date(item.dateTimeCreated)
    : new Date();
  const selfEmail = mailbox.userProfile?.emailAddress?.trim().toLowerCase() || "";
  const fromEmail = item.from?.emailAddress?.trim().toLowerCase() || "";
  const fromIsMailboxOwner = Boolean(fromEmail) && isMailboxOwnerEmail(fromEmail, [selfEmail]);
  const isOutbound =
    Boolean(options?.preferOutbound) || fromIsMailboxOwner;

  const to = await getRecipientsAsync(item.to);
  const cc = await getRecipientsAsync(item.cc);
  const recipientEmails = [...to, ...cc].map((entry) => entry.email);
  if (
    options?.primaryRecipientEmail &&
    !recipientEmails.includes(options.primaryRecipientEmail.trim().toLowerCase())
  ) {
    recipientEmails.unshift(options.primaryRecipientEmail.trim().toLowerCase());
  }

  const bodyPreview = item.body
    ? await readOutlookItemBodyPreview(item as Office.MailboxItem, office)
    : undefined;
  const subject = await readOutlookItemSubject(item);
  const fallbackSubject = coerceSubjectString(selected.subject);

  return {
    conversationId,
    externalMessageId,
    subject: subject !== "(no subject)" ? subject : fallbackSubject,
    senderEmail: isOutbound ? selfEmail || fromEmail : fromEmail,
    senderDisplayName: item.from?.displayName?.trim() || "",
    sentAt: Number.isNaN(created.getTime())
      ? new Date().toISOString()
      : created.toISOString(),
    isOutbound,
    recipientEmails,
    bodyPreview,
    webLink: buildOutlookReadDeeplink(externalMessageId) ?? undefined,
  };
}

async function seedFromOpenMailboxItem(
  office: typeof Office,
  options?: { preferOutbound?: boolean; primaryRecipientEmail?: string },
): Promise<OutlookOpenMessageSeed | null> {
  try {
    const mailbox = office.context.mailbox;
    const item = mailbox?.item;
    if (!item) return null;

    let conversationId = item.conversationId?.trim() || "";
    if (!conversationId && typeof item.getConversationIdAsync === "function") {
      conversationId = await new Promise<string>((resolve) => {
        item.getConversationIdAsync!((result) => {
          if (!isOfficeAsyncSuccess(result.status)) {
            resolve("");
            return;
          }
          resolve(result.value?.trim() || "");
        });
      });
    }
    if (!conversationId) return null;

    const ewsOrRestId = item.itemId?.trim() || "";
    if (!ewsOrRestId) return null;

    const externalMessageId = convertToRestId(mailbox, ewsOrRestId);
    const created = item.dateTimeCreated
      ? new Date(item.dateTimeCreated)
      : new Date();
    const selfEmail =
      mailbox?.userProfile?.emailAddress?.trim().toLowerCase() || "";
    const fromEmail = item.from?.emailAddress?.trim().toLowerCase() || "";
    const fromIsMailboxOwner = Boolean(fromEmail) && isMailboxOwnerEmail(fromEmail, [selfEmail]);
    const isOutbound =
      Boolean(options?.preferOutbound) || fromIsMailboxOwner;

    const recipients = await resolveOutlookReadRecipients({
      attempts: 3,
      delayMs: 200,
    }).catch(() => []);
    const recipientEmails = recipients.map((entry) => entry.email);
    if (
      options?.primaryRecipientEmail &&
      !recipientEmails.includes(options.primaryRecipientEmail.trim().toLowerCase())
    ) {
      recipientEmails.unshift(options.primaryRecipientEmail.trim().toLowerCase());
    }

    const bodyPreview = await readOutlookItemBodyPreview(item, office);
    const subject = await readOutlookItemSubject(item);

    return {
      conversationId,
      externalMessageId,
      subject,
      senderEmail: isOutbound ? selfEmail || fromEmail : fromEmail,
      senderDisplayName: item.from?.displayName?.trim() || "",
      sentAt: Number.isNaN(created.getTime())
        ? new Date().toISOString()
        : created.toISOString(),
      isOutbound,
      recipientEmails,
      bodyPreview,
      webLink: buildOutlookReadDeeplink(externalMessageId) ?? undefined,
    };
  } catch {
    return null;
  }
}

let selectedSeedCache: { key: string; seeds: OutlookOpenMessageSeed[] } | null = null;

function selectionCacheKey(
  selected: OutlookSelectedItemLite[],
  options?: { preferOutbound?: boolean; primaryRecipientEmail?: string; limit?: number },
): string {
  return [
    selected.map((row) => row.itemId ?? "").join(","),
    String(options?.limit ?? "all"),
    options?.preferOutbound ? "out" : "in",
    options?.primaryRecipientEmail ?? "",
  ].join("|");
}

/**
 * All currently selected read messages (bulk save). Falls back to the open item.
 * Multi-select has no mailbox.item — load each selected id, then lite ids if needed.
 */
export async function resolveOutlookSelectedMessageSeeds(options?: {
  preferOutbound?: boolean;
  primaryRecipientEmail?: string;
  limit?: number;
}): Promise<OutlookOpenMessageSeed[]> {
  if (typeof window === "undefined") return [];

  const office = await whenOfficeReady();
  if (!office) return [];

  const mailbox = office.context.mailbox;
  if (!mailbox) return [];

  const limit = Math.max(1, Math.min(options?.limit ?? MAX_SELECTED_MAILS, MAX_SELECTED_MAILS));
  const selected = (await getSelectedItemsLite(mailbox)).slice(0, limit);
  const cacheKey = selectionCacheKey(selected, options);
  if (selectedSeedCache?.key === cacheKey) {
    return selectedSeedCache.seeds;
  }

  const remember = (seeds: OutlookOpenMessageSeed[]) => {
    selectedSeedCache = { key: cacheKey, seeds };
    return seeds;
  };

  const canLoadById = mailboxSupports(office, "1.15");

  if (selected.length > 1) {
    const seeds: OutlookOpenMessageSeed[] = [];
    for (const row of selected) {
      const itemId = row.itemId?.trim();
      if (canLoadById && itemId) {
        const loaded = await loadMailboxItemById(mailbox, itemId);
        if (loaded) {
          try {
            const seed = await seedFromLoadedItem(mailbox, office, loaded, row, options);
            if (seed) {
              seeds.push(seed);
              continue;
            }
          } finally {
            await unloadMailboxItem(loaded);
          }
        }
      }
      const lite = seedFromSelectedLite(mailbox, row);
      if (lite) seeds.push(lite);
    }
    if (seeds.length > 0) return remember(seeds);
  }

  if (selected.length === 1 && canLoadById && selected[0]?.itemId) {
    const loaded = await loadMailboxItemById(mailbox, selected[0].itemId);
    if (loaded) {
      try {
        const seed = await seedFromLoadedItem(
          mailbox,
          office,
          loaded,
          selected[0],
          options,
        );
        if (seed) return remember([seed]);
      } finally {
        await unloadMailboxItem(loaded);
      }
    }
  }

  const open = await seedFromOpenMailboxItem(office, options);
  return remember(open ? [open] : []);
}

type MailboxSelectionEvents = {
  addHandlerAsync?: (
    eventType: Office.EventType | string,
    handler: () => void,
    callback?: () => void,
  ) => void;
  removeHandlerAsync?: (
    eventType: Office.EventType | string,
    options: { handler: () => void },
    callback?: () => void,
  ) => void;
};

export type OutlookMailboxItemKey = {
  itemId: string | null;
  conversationId: string | null;
};

export async function readOutlookMailboxItemKey(): Promise<OutlookMailboxItemKey> {
  const office = await whenOfficeReady();
  const item = office?.context.mailbox?.item;
  return {
    itemId: item?.itemId?.trim() || null,
    conversationId: item?.conversationId?.trim() || null,
  };
}

function mailboxItemFingerprint(key: OutlookMailboxItemKey): string {
  return `${key.itemId ?? ""}::${key.conversationId ?? ""}`;
}

async function addMailboxHandler(
  mailbox: MailboxSelectionEvents,
  eventType: Office.EventType | string,
  handler: () => void,
): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      mailbox.addHandlerAsync!(eventType, handler, () => resolve());
    } catch {
      resolve();
    }
  });
}

/**
 * Subscribe to Outlook selection changes. Prefer
 * {@link subscribeOutlookMailboxItemChanged} so API loads do not fire unless
 * `item.itemId` actually changed.
 */
export async function subscribeOutlookSelectedItemsChanged(
  onChanged: () => void,
): Promise<() => void> {
  const office = await whenOfficeReady();
  const mailbox = office?.context.mailbox as MailboxSelectionEvents | undefined;
  if (!mailbox?.addHandlerAsync) return () => undefined;

  const eventType =
    office?.EventType &&
    typeof office.EventType === "object" &&
    "SelectedItemsChanged" in office.EventType
      ? (office.EventType as { SelectedItemsChanged?: string }).SelectedItemsChanged ??
        "selectedItemsChanged"
      : "selectedItemsChanged";

  const handler = () => {
    onChanged();
  };

  await addMailboxHandler(mailbox, eventType, handler);

  return () => {
    try {
      mailbox.removeHandlerAsync?.(eventType, { handler }, () => undefined);
    } catch {
      // ignore
    }
  };
}

/**
 * Fires only when the open mailbox item identity changes (new email / context).
 * Ignores focus, folder chrome, and duplicate SelectedItemsChanged noise.
 */
export async function subscribeOutlookMailboxItemChanged(
  onChanged: (key: OutlookMailboxItemKey) => void,
): Promise<() => void> {
  const office = await whenOfficeReady();
  const mailbox = office?.context.mailbox as MailboxSelectionEvents | undefined;
  if (!mailbox?.addHandlerAsync) return () => undefined;

  let last = mailboxItemFingerprint(await readOutlookMailboxItemKey());

  const handler = () => {
    void (async () => {
      const next = await readOutlookMailboxItemKey();
      const fingerprint = mailboxItemFingerprint(next);
      if (fingerprint === last) return;
      last = fingerprint;
      onChanged(next);
    })();
  };

  const eventTypes: Array<Office.EventType | string> = [];
  if (office?.EventType?.ItemChanged) eventTypes.push(office.EventType.ItemChanged);
  else eventTypes.push("itemChanged");
  if (office?.EventType?.SelectedItemsChanged) {
    eventTypes.push(office.EventType.SelectedItemsChanged);
  } else {
    eventTypes.push("selectedItemsChanged");
  }

  for (const eventType of eventTypes) {
    await addMailboxHandler(mailbox, eventType, handler);
  }

  return () => {
    for (const eventType of eventTypes) {
      try {
        mailbox.removeHandlerAsync?.(eventType, { handler }, () => undefined);
      } catch {
        // ignore
      }
    }
  };
}

function readOutlookItemBodyPreview(
  item: Office.MailboxItem,
  office: NonNullable<typeof Office>,
): Promise<string | undefined> {
  if (!item.body?.getAsync) return Promise.resolve(undefined);
  const coercion = office.CoercionType?.Text ?? "text";
  return new Promise((resolve) => {
    try {
      item.body!.getAsync(coercion, (result) => {
        if (!isOfficeAsyncSuccess(result.status) || !result.value) {
          resolve(undefined);
          return;
        }
        const text = result.value.replace(/\s+/g, " ").trim().slice(0, 2000);
        resolve(text || undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Outlook item categories stay a no-op. Capture mail in SmartCRM instead;
 * Graph can tag when Mail.ReadWrite is connected.
 */
export async function applyOutlookItemSmartCrmCategories(_input: {
  opportunityName?: string;
  projectName?: string;
}): Promise<boolean> {
  return false;
}

export function resolveDevEmail(searchParams: URLSearchParams): string | null {
  const email = searchParams.get("email")?.trim().toLowerCase();
  return email || null;
}

export function resolveDevDisplayName(searchParams: URLSearchParams): string | null {
  const name = searchParams.get("name")?.trim();
  return name || null;
}

export function buildSmartCrmUrl(path: string): string {
  const base = resolvePublicAppOrigin();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
