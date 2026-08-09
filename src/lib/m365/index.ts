export { buildM365Meta, ensureImpact } from "./meta";
export { loadM365DataContext, resolveCompanyFromInput, resolveCompanyById } from "./resolve-context";
export { buildM365RelationshipCard } from "./relationship-card";
export { buildM365MeetingBriefing } from "./meeting-briefing";
export { buildM365DailyFocus } from "./daily-focus";
export { buildM365AccountWorkspace } from "./account-workspace";
export {
  ensureOpportunitySharePointFolder,
  sanitizeSharePointName,
  sanitizeSharePointFolderName,
} from "./graph-client";
export type { OpportunitySharePointFolder } from "./graph-client";
export { getGraphAccessToken } from "./get-graph-access-token";
export {
  scheduleOpportunitySharePointFolderProvision,
  provisionOpportunitySharePointFolder,
  linkOpportunitySharePointFolder,
} from "./provision-opportunity-folder";
export {
  resolveOutlookCounterpartyEmail,
  resolveOutlookConversationId,
  resolveOutlookSenderDetails,
  resolveDevEmail,
  resolveDevDisplayName,
  buildSmartCrmUrl,
} from "./outlook-context";
export {
  buildOutlookSenderPrepopulation,
  addOutlookContact,
} from "./outlook-add-contact";
export {
  canonicalCompanyDisplayName,
  resolveCompanyForEmail,
  resolveCompanyByDomain,
  resolveOutlookCompanyName,
  buildOutlookCompanyDisplay,
} from "./company-resolution";
export {
  normalizePhoneNumber,
  hasExplicitCountryCode,
} from "./phone-normalization";
export {
  parseSignatureIntelligence,
  parseSignaturePersonName,
  extractSignatureBlock,
} from "./signature-intelligence";
export {
  resolveOutlookMessageBody,
  resolveDevMessageBody,
} from "./outlook-message-body";
export {
  validateM365Payload,
  validateRelationshipCard,
  validateMeetingBriefing,
  validateDailyFocus,
  validateAccountWorkspace,
} from "./validation";
export type {
  M365SurfaceValidation,
  ValidationCheck,
  ValidationSection,
  ValidationStatus,
} from "./validation";
