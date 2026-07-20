import type {
  ActivityType,
  AgreedAction,
  LinkedDocument,
  SmartAssistAssessment,
} from "@/types/activity";
import type { SharePointLookup } from "@/types/company";

/** Canonical 9-section knowledge model for activities. */
export const ACTIVITY_KNOWLEDGE_SECTIONS = [
  { id: "what_happened", label: "What Happened", order: 1 },
  { id: "what_was_agreed", label: "What Was Agreed", order: 2 },
  { id: "what_happens_next", label: "What Happens Next", order: 3 },
  { id: "risks", label: "Risks", order: 4 },
  { id: "decisions", label: "Decisions", order: 5 },
  { id: "commitments", label: "Commitments", order: 6 },
  { id: "stakeholders", label: "Stakeholders", order: 7 },
  { id: "linked_context", label: "Linked Context", order: 8 },
  { id: "smartassist_assessment", label: "SmartAssist Assessment", order: 9 },
] as const;

export type ActivityKnowledgeSectionId =
  (typeof ACTIVITY_KNOWLEDGE_SECTIONS)[number]["id"];

/** Draft produced by SmartAssist knowledge capture. */
export type ActivityKnowledgeDraft = {
  summary: string;
  whatHappened: string;
  whatWasAgreed: string[];
  whatHappensNext: string;
  whatHappensNextDue?: string;
  risks: string[];
  decisions: string[];
  commitments: AgreedAction[];
  linkedDocuments: LinkedDocument[];
  linkedDeals: SharePointLookup[];
  linkedContacts: SharePointLookup[];
  assessment: SmartAssistAssessment;
};

export type KnowledgeCaptureSource =
  | ActivityType
  | "Workshop"
  | "Uploaded Recording"
  | "Uploaded Notes";

export const KNOWLEDGE_CAPTURE_SOURCES: KnowledgeCaptureSource[] = [
  "Teams Meeting",
  "Meeting",
  "Phone Call",
  "Email",
  "Email Follow-Up",
  "Site Visit",
  "Workshop",
  "Uploaded Recording",
  "Uploaded Notes",
];
