/** Minimal Office.js types for Outlook host integration. */

declare namespace Office {
  enum AsyncResultStatus {
    Succeeded = "succeeded",
    Failed = "failed",
  }

  enum CoercionType {
    Text = "text",
    Html = "html",
  }

  interface AsyncResult<T> {
    status: AsyncResultStatus;
    value: T;
    error?: { message: string };
  }

  interface EmailAddressDetails {
    emailAddress?: string;
    displayName?: string;
  }

  interface Recipients {
    getAsync(callback: (result: AsyncResult<EmailAddressDetails[]>) => void): void;
  }

  interface Body {
    getAsync(
      coercionType: CoercionType | string,
      callback: (result: AsyncResult<string>) => void,
    ): void;
  }

  interface MailboxItem {
    itemType?: string;
    from?: EmailAddressDetails;
    to?: Recipients;
    requiredAttendees?: Recipients;
    optionalAttendees?: Recipients;
    body?: Body;
  }

  interface Mailbox {
    item?: MailboxItem;
    userProfile?: {
      emailAddress?: string;
    };
  }

  interface Context {
    mailbox?: Mailbox;
  }

  function onReady(callback: (info: { host: unknown; platform: unknown }) => void): void;

  const context: Context;
  const CoercionType: typeof CoercionType;
}

declare const Office:
  | {
      onReady: (callback: (info: { host: unknown; platform: unknown }) => void) => void;
      context: Office.Context;
      AsyncResultStatus: typeof Office.AsyncResultStatus;
      CoercionType: typeof Office.CoercionType;
    }
  | undefined;
