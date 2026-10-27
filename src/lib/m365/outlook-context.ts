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
import {
  mailboxHostUsesRestItemIds,
  outlookSelectionFingerprint,
  toEwsMessageId,
  toGraphRestMessageId,
} from "@/lib/m365/outlook-selection";

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
  /** EWS id from the selection, when it differs from the REST id. */
  alternateItemId?: string;
  internetMessageId?: string;
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
      const [to, cc, bcc, required, optional] = await Promise.all([
        getRecipientsAsync(item.to),
        getRecipientsAsync(item.cc),
        getRecipientsAsync(item.bcc),
        getRecipientsAsync(item.requiredAttendees),
        getRecipientsAsync(item.optionalAttendees),
      ]);

      const seen = new Set<string>();
      const recipients: OutlookComposeRecipient[] = [];
      for (const entry of [...to, ...cc, ...bcc, ...required, ...optional]) {
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
 * Put a CRM contact onto Outlook To. Best-effort — CRM assign still works if Outlook refuses.
 */
export async function addOutlookComposeRecipient(input: {
  email: string;
  displayName?: string;
}): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return false;

  const office = await whenOfficeReady();
  const to = office?.context.mailbox?.item?.to;
  if (!to?.addAsync) return false;

  return await new Promise((resolve) => {
    try {
      to.addAsync!(
        [
          {
            emailAddress: email,
            displayName: input.displayName?.trim() || email,
          },
        ],
        (result) => resolve(isOfficeAsyncSuccess(result.status)),
      );
    } catch {
      resolve(false);
    }
  });
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
  internetMessageId?: string;
  subject?: string;
};

function mailboxHostName(mailbox: Office.Mailbox): string {
  return (
    (mailbox as { diagnostics?: { hostName?: string } }).diagnostics?.hostName?.trim() || ""
  );
}

function convertToRestId(mailbox: Office.Mailbox, itemId: string): string {
  const raw = itemId.trim();
  if (!raw) return "";
  if (
    !mailboxHostUsesRestItemIds(mailboxHostName(mailbox)) &&
    (raw.includes("/") || raw.includes("+"))
  ) {
    try {
      const convert = (
        mailbox as {
          convertToRestId?: (id: string, version: string) => string;
        }
      ).convertToRestId;
      if (typeof convert === "function") {
        const restId = convert.call(mailbox, raw, "v2.0")?.trim();
        if (restId) return toGraphRestMessageId(restId);
      }
    } catch {
      // Fall through to deterministic v2.0 character mapping.
    }
  }
  return toGraphRestMessageId(raw);
}

function convertToEwsId(mailbox: Office.Mailbox, itemId: string): string {
  const raw = itemId.trim();
  if (!raw) return "";
  if (raw.includes("/") || raw.includes("+")) return raw;
  try {
    const convert = (
      mailbox as {
        convertToEwsId?: (id: string, version: string) => string;
      }
    ).convertToEwsId;
    if (typeof convert === "function") {
      const ewsId = convert.call(mailbox, raw, "v2.0")?.trim();
      if (ewsId) return ewsId;
    }
  } catch {
    // EWS cannot run on a REST id in this host.
  }
  return toEwsMessageId(raw);
}

const OFFICE_CALL_TIMEOUT_MS = 5000;

function withOfficeTimeout<T>(work: Promise<T>, fallback: T, ms = OFFICE_CALL_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function normalizeSelectedItems(value: unknown): OutlookSelectedItemLite[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  const normalized: OutlookSelectedItemLite[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const itemId = typeof record.itemId === "string" ? record.itemId.trim() : "";
    if (!itemId) continue;
    normalized.push({
      itemId,
      conversationId:
        typeof record.conversationId === "string" ? record.conversationId : undefined,
      internetMessageId:
        typeof record.internetMessageId === "string" ? record.internetMessageId : undefined,
      subject: typeof record.subject === "string" ? record.subject : undefined,
    });
  }
  return normalized;
}

function readSelectedItemsOnce(mailbox: Office.Mailbox): Promise<OutlookSelectedItemLite[]> {
  const getSelected = (
    mailbox as {
      getSelectedItemsAsync?: (
        callback: (result: Office.AsyncResult<unknown>) => void,
      ) => void;
    }
  ).getSelectedItemsAsync;
  if (typeof getSelected !== "function") return Promise.resolve([]);

  return new Promise((resolve) => {
    try {
      getSelected.call(mailbox, (result) => {
        if (!isOfficeAsyncSuccess(result.status) || result.value == null) {
          resolve([]);
          return;
        }
        resolve(normalizeSelectedItems(result.value));
      });
    } catch {
      resolve([]);
    }
  });
}

/**
 * Checked messages. On the "N items selected" pane, mailbox.item is empty and
 * the first read can land before Outlook attaches the checks.
 */
async function getSelectedItemsLite(
  mailbox: Office.Mailbox,
): Promise<OutlookSelectedItemLite[]> {
  const read = () => withOfficeTimeout(readSelectedItemsOnce(mailbox), []);
  let rows = await read();
  if (rows.length === 0 && !mailbox.item) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    rows = await read();
  }
  return rows;
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
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, OFFICE_CALL_TIMEOUT_MS);
    try {
      load.call(mailbox, itemId, (result) => {
        const item =
          isOfficeAsyncSuccess(result.status) && result.value ? result.value : null;
        if (settled) {
          if (item) void unloadMailboxItem(item);
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        resolve(item);
      });
    } catch {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
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

function seedIsUsable(seed: OutlookOpenMessageSeed): boolean {
  return Boolean(
    seed.externalMessageId.trim() && seed.conversationId.trim() && seed.senderEmail.trim(),
  );
}

function sameMailboxItemId(mailbox: Office.Mailbox, a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return convertToRestId(mailbox, a) === convertToRestId(mailbox, b);
}

function canLoadItemById(mailbox: Office.Mailbox): boolean {
  return (
    typeof (mailbox as { loadItemByIdAsync?: unknown }).loadItemByIdAsync === "function"
  );
}

function seedFromSelectedLite(
  mailbox: Office.Mailbox,
  selected: OutlookSelectedItemLite,
): OutlookOpenMessageSeed | null {
  const ewsOrRestId = selected.itemId?.trim() || "";
  if (!ewsOrRestId) return null;

  const externalMessageId = convertToRestId(mailbox, ewsOrRestId);
  return {
    conversationId: selected.conversationId?.trim() || "",
    externalMessageId,
    alternateItemId: ewsOrRestId,
    internetMessageId: selected.internetMessageId?.trim() || undefined,
    subject: coerceSubjectString(selected.subject),
    senderEmail: "",
    sentAt: "",
    isOutbound: false,
    webLink: buildOutlookReadDeeplink(externalMessageId) ?? undefined,
  };
}

function mergeOutlookSeed(
  base: OutlookOpenMessageSeed,
  extra: Partial<OutlookOpenMessageSeed>,
): OutlookOpenMessageSeed {
  const replaceId = (!base.conversationId.trim() || !base.senderEmail.trim()) && extra.externalMessageId;
  return {
    ...base,
    externalMessageId: replaceId ? extra.externalMessageId! : base.externalMessageId || extra.externalMessageId || "",
    alternateItemId: base.alternateItemId || extra.alternateItemId,
    internetMessageId: base.internetMessageId || extra.internetMessageId,
    conversationId: base.conversationId.trim() || extra.conversationId || "",
    subject:
      base.subject && base.subject !== "(no subject)"
        ? base.subject
        : extra.subject || base.subject,
    senderEmail: base.senderEmail.trim() || extra.senderEmail || "",
    senderDisplayName: base.senderDisplayName || extra.senderDisplayName,
    sentAt: base.sentAt || extra.sentAt || "",
    isOutbound: base.senderEmail.trim() ? base.isOutbound : extra.isOutbound,
    recipientEmails: base.recipientEmails?.length ? base.recipientEmails : extra.recipientEmails,
    bodyPreview: base.bodyPreview || extra.bodyPreview,
    webLink: base.webLink || extra.webLink,
  };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function childByLocalName(parent: Element, localName: string): Element | null {
  for (const node of Array.from(parent.children)) {
    if (node.localName === localName) return node;
  }
  return null;
}

function firstMailboxAddress(parent: Element | null): { email: string; name: string } {
  if (!parent) return { email: "", name: "" };
  let email = "";
  let name = "";
  for (const node of Array.from(parent.getElementsByTagName("*"))) {
    if (!email && node.localName === "EmailAddress") {
      email = node.textContent?.trim().toLowerCase() || "";
    }
    if (!name && node.localName === "Name") name = node.textContent?.trim() || "";
    if (email && name) break;
  }
  return { email, name };
}

function recipientEmailsFrom(parent: Element, listName: string): string[] {
  const list = childByLocalName(parent, listName);
  if (!list) return [];
  const emails: string[] = [];
  for (const node of Array.from(list.getElementsByTagName("*"))) {
    if (node.localName !== "EmailAddress") continue;
    const email = node.textContent?.trim().toLowerCase() || "";
    if (email.includes("@")) emails.push(email);
  }
  return emails;
}

function makeEwsRequest(mailbox: Office.Mailbox, xml: string): Promise<string | null> {
  const request = (
    mailbox as {
      makeEwsRequestAsync?: (
        data: string,
        callback: (result: Office.AsyncResult<string>) => void,
      ) => void;
    }
  ).makeEwsRequestAsync;
  if (typeof request !== "function") return Promise.resolve(null);
  return withOfficeTimeout(
    new Promise<string | null>((resolve) => {
      try {
        request.call(mailbox, xml, (result) => {
          if (!isOfficeAsyncSuccess(result.status) || typeof result.value !== "string") {
            resolve(null);
            return;
          }
          resolve(result.value);
        });
      } catch {
        resolve(null);
      }
    }),
    null,
    8000,
  );
}

function seedFromEwsMessage(
  mailbox: Office.Mailbox,
  message: Element,
  base: OutlookOpenMessageSeed,
): OutlookOpenMessageSeed {
  const itemId = childByLocalName(message, "ItemId")?.getAttribute("Id")?.trim() || "";
  const conversationId =
    childByLocalName(message, "ConversationId")?.getAttribute("Id")?.trim() || "";
  const subject = childByLocalName(message, "Subject")?.textContent?.trim() || "";
  const sentAt =
    childByLocalName(message, "DateTimeReceived")?.textContent?.trim() ||
    childByLocalName(message, "DateTimeSent")?.textContent?.trim() ||
    "";
  const from = firstMailboxAddress(childByLocalName(message, "From"));
  const isFromMe = childByLocalName(message, "IsFromMe")?.textContent?.trim().toLowerCase() === "true";
  const selfEmail = mailbox.userProfile?.emailAddress?.trim().toLowerCase() || "";
  const externalMessageId = itemId ? convertToRestId(mailbox, itemId) : base.externalMessageId;
  return mergeOutlookSeed(base, {
    externalMessageId,
    alternateItemId: itemId || base.alternateItemId,
    conversationId,
    subject: subject || base.subject,
    senderEmail: isFromMe ? selfEmail || from.email : from.email,
    senderDisplayName: from.name,
    sentAt,
    isOutbound: isFromMe,
    recipientEmails: [
      ...recipientEmailsFrom(message, "ToRecipients"),
      ...recipientEmailsFrom(message, "CcRecipients"),
    ],
    webLink: buildOutlookReadDeeplink(externalMessageId) ?? undefined,
  });
}

async function enrichSeedsFromEws(
  mailbox: Office.Mailbox,
  seeds: OutlookOpenMessageSeed[],
): Promise<OutlookOpenMessageSeed[]> {
  const pending = seeds.filter((seed) => !seedIsUsable(seed));
  const itemIds = pending
    .map((seed) =>
      convertToEwsId(mailbox, seed.alternateItemId?.trim() || seed.externalMessageId.trim()),
    )
    .filter(Boolean);
  if (itemIds.length === 0 || typeof DOMParser === "undefined") return seeds;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
 xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2013" />
  </soap:Header>
  <soap:Body>
    <m:GetItem>
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject" />
          <t:FieldURI FieldURI="item:DateTimeReceived" />
          <t:FieldURI FieldURI="item:DateTimeSent" />
          <t:FieldURI FieldURI="item:ConversationId" />
          <t:FieldURI FieldURI="message:From" />
          <t:FieldURI FieldURI="message:ToRecipients" />
          <t:FieldURI FieldURI="message:CcRecipients" />
          <t:FieldURI FieldURI="message:IsFromMe" />
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:ItemIds>
        ${itemIds.map((id) => `<t:ItemId Id="${xmlEscape(id)}" />`).join("")}
      </m:ItemIds>
    </m:GetItem>
  </soap:Body>
</soap:Envelope>`;

  const responseXml = await makeEwsRequest(mailbox, xml);
  if (!responseXml) return seeds;

  let messages: Element[] = [];
  try {
    const doc = new DOMParser().parseFromString(responseXml, "text/xml");
    messages = Array.from(doc.getElementsByTagName("*")).filter((node) =>
      node.localName === "Message" ||
      node.localName === "MeetingRequest" ||
      node.localName === "MeetingResponse" ||
      node.localName === "MeetingCancellation",
    );
  } catch {
    return seeds;
  }
  if (messages.length === 0) return seeds;

  const paired = new Map<string, Element>();
  const used = new Set<Element>();
  for (const message of messages) {
    const id = childByLocalName(message, "ItemId")?.getAttribute("Id")?.trim() || "";
    const seed = pending.find(
      (row) =>
        !used.has(message) &&
        (row.alternateItemId === id ||
          row.externalMessageId === id ||
          (id && sameMailboxItemId(mailbox, row.alternateItemId || row.externalMessageId, id))),
    );
    if (!seed) continue;
    paired.set(seed.externalMessageId, message);
    used.add(message);
  }
  const unmatchedSeeds = pending.filter((seed) => !paired.has(seed.externalMessageId));
  const unmatchedMessages = messages.filter((message) => !used.has(message));
  if (unmatchedSeeds.length > 0 && unmatchedSeeds.length === unmatchedMessages.length) {
    unmatchedSeeds.forEach((seed, index) => {
      paired.set(seed.externalMessageId, unmatchedMessages[index]!);
    });
  }

  return seeds.map((seed) => {
    const message = paired.get(seed.externalMessageId);
    return message ? seedFromEwsMessage(mailbox, message, seed) : seed;
  });
}

async function enrichSeedsFromGraph(
  seeds: OutlookOpenMessageSeed[],
): Promise<OutlookOpenMessageSeed[]> {
  const pending = seeds.filter((seed) => !seedIsUsable(seed) && seed.externalMessageId.trim());
  if (pending.length === 0 || typeof fetch !== "function") return seeds;
  try {
    const response = await fetch("/api/m365/outlook/selected-messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: pending.map((seed) => ({
          itemId: seed.externalMessageId,
          alternateItemId: seed.alternateItemId,
          internetMessageId: seed.internetMessageId,
        })),
      }),
    });
    if (!response.ok) return seeds;
    const payload = (await response.json()) as {
      messages?: Array<Partial<OutlookOpenMessageSeed> & { requestItemId?: string }>;
      needsMicrosoftConsent?: boolean;
    };
    if (payload.needsMicrosoftConsent) selectionReadNeedsConsent = true;
    const hydrated = payload.messages ?? [];
    return seeds.map((seed) => {
      const match = hydrated.find(
        (row) =>
          row.requestItemId === seed.externalMessageId ||
          (seed.alternateItemId && row.requestItemId === seed.alternateItemId) ||
          (seed.internetMessageId && row.internetMessageId === seed.internetMessageId),
      );
      return match ? mergeOutlookSeed(seed, match) : seed;
    });
  } catch {
    return seeds;
  }
}

async function enrichIncompleteSeeds(
  mailbox: Office.Mailbox,
  seeds: OutlookOpenMessageSeed[],
): Promise<OutlookOpenMessageSeed[]> {
  if (seeds.every(seedIsUsable)) return seeds;
  const fromEws = await enrichSeedsFromEws(mailbox, seeds);
  if (fromEws.every(seedIsUsable)) return fromEws;
  return enrichSeedsFromGraph(fromEws);
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
let selectedSeedInflight: { key: string; promise: Promise<OutlookOpenMessageSeed[]> } | null =
  null;
let selectionReadNeedsConsent = false;

/** True when checked mails could not be read because Microsoft 365 is not connected. */
export function outlookSelectionNeedsMicrosoftConsent(): boolean {
  return selectionReadNeedsConsent;
}

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

async function seedForSelectedRow(
  mailbox: Office.Mailbox,
  office: typeof Office,
  row: OutlookSelectedItemLite,
  openItemId: string,
  options?: {
    preferOutbound?: boolean;
    primaryRecipientEmail?: string;
    skipItemLoad?: boolean;
  },
): Promise<OutlookOpenMessageSeed | null> {
  const itemId = row.itemId?.trim() || "";
  if (itemId && openItemId && sameMailboxItemId(mailbox, itemId, openItemId)) {
    const open = await seedFromOpenMailboxItem(office, options);
    if (open) return open;
  }
  if (!options?.skipItemLoad && itemId && canLoadItemById(mailbox)) {
    const loaded = await loadMailboxItemById(mailbox, itemId);
    if (loaded) {
      try {
        const seed = await seedFromLoadedItem(mailbox, office, loaded, row, options);
        if (seed) return seed;
      } finally {
        await unloadMailboxItem(loaded);
      }
    }
  }
  return seedFromSelectedLite(mailbox, row);
}

/**
 * All currently selected read messages (bulk save). Falls back to the open item
 * only when Outlook is not in a multi-select (no single open mail to substitute).
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
  if (selectedSeedInflight?.key === cacheKey) {
    return selectedSeedInflight.promise;
  }

  const promise = resolveSelectedSeedsNow(office, mailbox, selected, cacheKey, options);
  selectedSeedInflight = { key: cacheKey, promise };
  try {
    return await promise;
  } finally {
    if (selectedSeedInflight?.promise === promise) selectedSeedInflight = null;
  }
}

async function resolveSelectedSeedsNow(
  office: typeof Office,
  mailbox: Office.Mailbox,
  selected: OutlookSelectedItemLite[],
  cacheKey: string,
  options?: { preferOutbound?: boolean; primaryRecipientEmail?: string },
): Promise<OutlookOpenMessageSeed[]> {
  const remember = (seeds: OutlookOpenMessageSeed[]) => {
    selectedSeedCache = { key: cacheKey, seeds };
    return seeds;
  };

  selectionReadNeedsConsent = false;
  const openItemId = mailbox.item?.itemId?.trim() || "";
  const selectionIsBulk = selected.length > 1 || (selected.length > 0 && !mailbox.item);

  if (selectionIsBulk) {
    const seeds: OutlookOpenMessageSeed[] = [];
    for (const row of selected) {
      const seed = await seedForSelectedRow(mailbox, office, row, openItemId, {
        ...options,
        skipItemLoad: true,
      });
      if (seed) seeds.push(seed);
    }
    let enriched = await enrichIncompleteSeeds(mailbox, seeds);
    if (!enriched.some(seedIsUsable) && canLoadItemById(mailbox) && selected[0]?.itemId) {
      const loaded = await loadMailboxItemById(mailbox, selected[0].itemId);
      if (loaded) {
        try {
          const recovered = await seedFromLoadedItem(
            mailbox,
            office,
            loaded,
            selected[0],
            options,
          );
          if (recovered) {
            enriched = enriched.map((seed, index) =>
              index === 0 ? mergeOutlookSeed(seed, recovered) : seed,
            );
          }
        } finally {
          await unloadMailboxItem(loaded);
        }
      }
    }
    const withIds = enriched.filter((seed) => seed.externalMessageId.trim());
    if (withIds.length === 0) return [];
    if (withIds.every(seedIsUsable)) return remember(withIds);
    return withIds;
  }

  if (selected.length === 1) {
    const seed = await seedForSelectedRow(mailbox, office, selected[0]!, openItemId, options);
    if (seed && seedIsUsable(seed)) return remember([seed]);
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

async function readOutlookSelectionFingerprint(): Promise<string> {
  const office = await whenOfficeReady();
  const mailbox = office?.context.mailbox;
  const item = mailbox?.item;
  const selected = mailbox ? await getSelectedItemsLite(mailbox) : [];
  return outlookSelectionFingerprint(
    item?.itemId,
    item?.conversationId,
    selected.map((row) => row.itemId || ""),
  );
}

/**
 * Fires when the open mail changes, or when the checked set changes.
 * New Outlook clears mailbox.item while several mails are marked, so the
 * checked ids are part of the identity.
 */
export async function subscribeOutlookMailboxItemChanged(
  onChanged: (key: OutlookMailboxItemKey) => void,
): Promise<() => void> {
  const office = await whenOfficeReady();
  const mailbox = office?.context.mailbox as MailboxSelectionEvents | undefined;
  if (!mailbox?.addHandlerAsync) return () => undefined;

  let last = await readOutlookSelectionFingerprint();
  let timer: number | undefined;

  const handler = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void (async () => {
        const fingerprint = await readOutlookSelectionFingerprint();
        if (fingerprint === last) return;
        last = fingerprint;
        onChanged(await readOutlookMailboxItemKey());
      })();
    }, 200);
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
    window.clearTimeout(timer);
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
