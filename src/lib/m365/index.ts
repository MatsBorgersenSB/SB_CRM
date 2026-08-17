export { buildM365Meta, ensureImpact } from "./meta";
export { loadM365DataContext, resolveCompanyFromInput, resolveCompanyById } from "./resolve-context";
export { buildM365RelationshipCard } from "./relationship-card";
export { buildM365MeetingBriefing } from "./meeting-briefing";
export { buildM365DailyFocus } from "./daily-focus";
export { buildM365AccountWorkspace } from "./account-workspace";
export {
  ensureOpportunitySharePointFolder,
  ensureCompanyDocumentsSharePointFolder,
  sanitizeSharePointName,
  sanitizeSharePointFolderName,
} from "./graph-client";
export type {
  OpportunitySharePointFolder,
  CompanyDocumentsSharePointFolder,
} from "./graph-client";
export { getGraphAccessToken } from "./get-graph-access-token";
export {
  scheduleOpportunitySharePointFolderProvision,
  provisionOpportunitySharePointFolder,
  linkOpportunitySharePointFolder,
} from "./provision-opportunity-folder";
export { provisionCompanyDocumentsSharePointFolder } from "./provision-company-folder";
export {
  resolveOutlookCounterpartyEmail,
  resolveOutlookConversationId,
  resolveOutlookOpenMessageSeed,
  resolveOutlookSenderDetails,
  resolveDevEmail,
  resolveDevDisplayName,
  buildSmartCrmUrl,
} from "./outlook-context";
export type { OutlookOpenMessageSeed } from "./outlook-context";
export {
  buildOutlookSenderPrepopulation,
  addOutlookContact,
} from "./outlook-add-contact";
export {
  buildRelationshipIntakeProposal,
  approveRelationshipIntake,
} from "./relationship-intake";
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
