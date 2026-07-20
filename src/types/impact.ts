/**
 * SmartCRM Impact Standard
 *
 * Every risk, recommendation, and opportunity warning MUST include impact —
 * the answer to "Why should I care?"
 *
 * Impact types (use at least one per signal):
 * - Commercial: pipeline value, deal count, forecast exposure
 * - Relationship: trust, momentum, stakeholder coverage
 * - Knowledge: document gaps, compliance, blocked deals
 * - Time: overdue, stalled days, expiry dates
 */

export type ImpactSignal = {
  /** Primary label — what is wrong or what to do */
  label: string;
  /** Supporting detail — what happened */
  detail?: string;
  /** Why should I care? — 1–3 consequence lines (required) */
  impact: string[];
};

export function hasImpact(signal: { impact?: string[] }): boolean {
  return Array.isArray(signal.impact) && signal.impact.length > 0;
}

/** Validates impact before rendering in M365 or primary UI surfaces. */
export function assertImpact(signal: ImpactSignal, context: string): ImpactSignal {
  if (signal.impact.length === 0) {
    console.warn(`[SmartCRM Impact] Missing impact for ${context}: ${signal.label}`);
  }
  return signal;
}
