export type Interaction = {
  interactionId: string;
  contactId: string;
  pipelineId?: string;
  type: string;
  timestamp: string;
  summary: string;
};

export const defaultInteractions: Interaction[] = [
  {
    interactionId: "INT-9001",
    contactId: "CT-10011",
    pipelineId: "PL-1042",
    type: "Deal Assignment",
    timestamp: "2026-07-04 09:12",
    summary:
      "Elena Lindström assigned as Deal Sponsor on Polymer Regrind Loop (PL-1042).",
  },
  {
    interactionId: "INT-9002",
    contactId: "CT-10011",
    pipelineId: "PL-1042",
    type: "SmartDocs Upload",
    timestamp: "2026-07-05 11:38",
    summary:
      "Financial invoice auto-renamed to PL-1042_Financial-Invoice.01 Q3 Report.pdf via Gemini parse.",
  },
  {
    interactionId: "INT-9003",
    contactId: "CT-10011",
    pipelineId: "PL-1031",
    type: "Deal Assignment",
    timestamp: "2026-07-05 14:02",
    summary:
      "Role transition logged: Elena elevated to cross-site Technical Lead on Thermal Recovery Line.",
  },
  {
    interactionId: "INT-9004",
    contactId: "CT-10011",
    pipelineId: "PL-1031",
    type: "Audit Note",
    timestamp: "2026-07-06 08:47",
    summary:
      "Compliance audit note filed for mixed-plastics feedstock variance on PL-1031 recovery route.",
  },
  {
    interactionId: "INT-9005",
    contactId: "CT-10011",
    pipelineId: "PL-1042",
    type: "Audit Note",
    timestamp: "2026-07-06 15:49",
    summary:
      "Throughput reconciliation signed off; HDPE Batch A conversion held at 94.2%.",
  },
];
