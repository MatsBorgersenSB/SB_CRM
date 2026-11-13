import type { UnderstandingFieldId } from "@/types/opportunity-understanding";

/** FS-024 commercial vs technical position. */
export type QueryPositionType = "commercial" | "technical";

export type QueryPackStatus =
  | "draft"
  | "sent"
  | "partially_returned"
  | "returned"
  | "imported"
  | "closed";

export type QueryPositionStatus = "open" | "answered" | "waived";

/** Supporting material on a question — links only as SoT (SharePoint / web). */
export type QueryPositionAttachmentKind = "url" | "document" | "picture";

export type QueryPositionAttachment = {
  id: string;
  kind: QueryPositionAttachmentKind;
  /** What the user sees */
  label: string;
  /** SharePoint or web URL (or small data: image for picture only) */
  url: string;
};

export type QueryPositionProvenance = {
  packId: string;
  companyId?: string;
  sharePointItemId?: string;
  sharePointVersionId?: string;
  importedAt?: string;
  sourceFileName?: string;
};

export type QueryPosition = {
  questionId: string;
  type: QueryPositionType;
  question: string;
  /** Optional Understanding field hint — never invented on import. */
  fieldId?: UnderstandingFieldId;
  companyId?: string;
  companyTitle?: string;
  contactId?: string;
  contactTitle?: string;
  status: QueryPositionStatus;
  answer?: string;
  comment?: string;
  /** YYYY-MM-DD — when a reply is needed */
  responseRequiredBy?: string;
  attachments?: QueryPositionAttachment[];
  provenance?: QueryPositionProvenance;
};

export type QueryPackRecipientFile = {
  companyId: string;
  companyTitle: string;
  /** SharePoint or download URL when known */
  fileUrl?: string;
  sharePointItemId?: string;
  sharePointVersionId?: string;
  sentAt?: string;
  returnedAt?: string;
};

/** One Query Pack per opportunity/project (current pack). */
export type QueryPack = {
  packId: string;
  scope: "opportunity" | "project";
  scopeId: string;
  title: string;
  status: QueryPackStatus;
  positions: QueryPosition[];
  recipientFiles: QueryPackRecipientFile[];
  masterFileUrl?: string;
  createdAt: string;
  updatedAt: string;
  ownerTitle?: string;
};

export type QueryPackImportRow = {
  questionId: string;
  answer: string;
  comment: string;
  answeredAt: string;
  companyId?: string;
};

export type QueryPackAnswerProposal = {
  questionId: string;
  previousAnswer?: string;
  nextAnswer: string;
  previousComment?: string;
  nextComment: string;
  fieldId?: UnderstandingFieldId;
  companyId?: string;
  companyTitle?: string;
  question: string;
  type: QueryPositionType;
};

export type QueryPackImportResult = {
  proposals: QueryPackAnswerProposal[];
  unmatched: Array<{ reason: string; raw: Record<string, string> }>;
};
