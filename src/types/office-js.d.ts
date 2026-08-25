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

  enum EventType {
    DialogMessageReceived = "dialogMessageReceived",
    DialogEventReceived = "dialogEventReceived",
    RecipientsChanged = "recipientsChanged",
    ItemChanged = "itemChanged",
    SelectedItemsChanged = "selectedItemsChanged",
  }

  interface AsyncResult<T> {
    status: AsyncResultStatus | string | number;
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
    itemId?: string;
    conversationId?: string;
    subject?: string;
    dateTimeCreated?: Date | string;
    from?: EmailAddressDetails;
    to?: Recipients;
    cc?: Recipients;
    bcc?: Recipients;
    requiredAttendees?: Recipients;
    optionalAttendees?: Recipients;
    body?: Body;
    saveAsync?: (
      callback: (result: AsyncResult<{ itemId?: string } | string>) => void,
    ) => void;
    getConversationIdAsync?: (
      callback: (result: AsyncResult<string>) => void,
    ) => void;
    addHandlerAsync?: (
      eventType: EventType | string,
      handler: (args?: unknown) => void,
      callback?: (result: AsyncResult<void>) => void,
    ) => void;
    removeHandlerAsync?: (
      eventType: EventType | string,
      options?: { handler?: (args?: unknown) => void },
      callback?: (result: AsyncResult<void>) => void,
    ) => void;
    categories?: {
      addAsync: (
        categories: string[],
        callback: (result: AsyncResult<void>) => void,
      ) => void;
    };
  }

  interface Mailbox {
    item?: MailboxItem;
    userProfile?: {
      emailAddress?: string;
    };
    addHandlerAsync?: (
      eventType: EventType | string,
      handler: (args?: unknown) => void,
      callback?: (result: AsyncResult<void>) => void,
    ) => void;
    removeHandlerAsync?: (
      eventType: EventType | string,
      options?: { handler?: (args?: unknown) => void },
      callback?: (result: AsyncResult<void>) => void,
    ) => void;
  }

  interface Dialog {
    close(): void;
    addEventHandler(
      eventType: EventType | string,
      handler: (arg: { message?: string; error?: number } | string) => void,
    ): void;
  }

  interface UI {
    displayDialogAsync(
      url: string,
      options: {
        height?: number;
        width?: number;
        displayInIframe?: boolean;
        promptBeforeOpen?: boolean;
      },
      callback: (result: AsyncResult<Dialog>) => void,
    ): void;
    messageParent?(message: string): void;
  }

  interface Context {
    mailbox?: Mailbox;
    ui?: UI;
  }

  function onReady(callback: (info: { host: unknown; platform: unknown }) => void): void;

  const context: Context;
  const CoercionType: typeof CoercionType;
  const EventType: typeof EventType;
}

declare const Office:
  | {
      onReady: (callback: (info: { host: unknown; platform: unknown }) => void) => void;
      context: Office.Context;
      AsyncResultStatus: typeof Office.AsyncResultStatus;
      CoercionType: typeof Office.CoercionType;
      EventType: typeof Office.EventType;
    }
  | undefined;
