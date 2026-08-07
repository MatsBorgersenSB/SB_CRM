/** SmartDocs library row — SharePoint SmartDocs list shape. */
export type SmartDocLibraryRecord = {
  id: number;
  SmartDocID: string;
  DealId: string;
  PlNumber: string;
  ClientName: string;
  DealName: string;
  CommercialStage: string;
  CreatedAt: string;
  DocCategory: SmartDocCategory;
  DocType: string;
  DocumentName: string;
  Revision: string;
  FileLeafRef: string;
  /** Assigned Document Set (e.g. FQ-001). */
  DocumentSetID?: string;
};

export type SmartDocCategory =
  | "Commercial"
  | "Legal"
  | "Technical"
  | "Financial"
  | "Operational"
  | "General";

export const SMARTDOC_CATEGORIES: SmartDocCategory[] = [
  "Commercial",
  "Legal",
  "Technical",
  "Financial",
  "Operational",
  "General",
];

export const SMARTDOC_TYPES_BY_CATEGORY: Record<SmartDocCategory, string[]> = {
  Commercial: [
    "Formal Quotation",
    "Budget Quotation",
    "Price Indication",
    "Sales Proposal",
    "Order Confirmation",
    "Terms Schedule",
    "Payment Milestones",
  ],
  Legal: ["NDA Contract", "Signed Contract", "Vendor Agreement", "MSA"],
  Technical: [
    "Technical Datasheet",
    "Process Summary",
    "Heat Balance",
    "Clarifications",
  ],
  Financial: ["Invoice", "Budget Report", "Payment Schedule"],
  Operational: ["Business Report", "Meeting Notes", "Project Plan"],
  General: ["Unclassified Document", "Attachment", "Correspondence"],
};

export type DealDocumentContext = {
  plNumber: string;
  clientName: string;
  dealId: string;
  dealName: string;
  commercialStage: string;
  createdAt: string;
};

export type SmartDocNameSuggestions = {
  primary: string;
  alternatives: string[];
};

export type SmartDocIdentityPreview = {
  documentId: string;
  suggestedName: string;
  categoryCode: string;
  categoryLabel: string;
  typeCode: string;
};

export type CreateSmartDocInput = {
  DocCategory: SmartDocCategory;
  DocType: string;
  DocumentName: string;
  originalFileName?: string;
  DocumentSetID?: string;
};
