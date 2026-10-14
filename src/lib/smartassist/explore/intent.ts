import type { ExploreIntent } from "@/lib/smartassist/explore/types";

const TRAILING_NOISE =
  /\s*(?:\(.*?\)|\[.*?\]|for me|please|thanks?|in (?:the )?crm|in smartcrm|business intelligence|bi)\s*$/i;

function tidySubject(raw: string): string {
  let subject = raw.trim().replace(/[?!.]+$/, "").trim();
  // Strip parenthetical asides and politeness repeatedly: "Romerike Biogass (business intelligence) please".
  for (let i = 0; i < 3; i += 1) {
    const next = subject.replace(TRAILING_NOISE, "").trim();
    if (next === subject) break;
    subject = next;
  }
  return subject.replace(/^(?:the|a|an)\s+/i, "").trim();
}

const COMPANY_LEADS = [
  /^(?:please\s+)?(?:explore|research|investigate|look\s*up|lookup|check|check out|profile|brief me on|find out about|tell me about|tell me more about)\s+(.+)$/i,
  /^(?:who|what)\s+(?:is|are|'s)\s+(.+)$/i,
  /^what\s+do\s+we\s+know\s+about\s+(.+)$/i,
  /^(?:do we know|have we (?:met|talked to|spoken to|worked with))\s+(.+)$/i,
];

const SUPPLIER_PATTERN =
  /^(?:find|explore|look for|search for|identify|list|who (?:sells|supplies|delivers))?\s*(?:potential\s+|possible\s+)?(.+?)\s+(?:suppliers?|sources?|vendors?|producers?|providers?)\s*(?:with contacts?)?\s*(?:in|near|around|close to)\s+(?:the\s+(?:region|area)\s+of\s+)?(.+)$/i;

const SUPPLIER_WORD = /\b(suppliers?|sources?|vendors?|producers?|leverand\w*)\b/i;
const SUPPLIER_PATTERN_LOOSE =
  /(?:suppliers?|sources?|vendors?|producers?)\s+(?:of|for)\s+(.+?)\s+(?:in|near|around)\s+(?:the\s+(?:region|area)\s+of\s+)?(.+)$/i;

const REGULATION_WORDS =
  /\b(maximum|max\.?|minimum|limit|limits|threshold|allowed|permitted|regulation|regulations|forskrift|requirement|requirements|legal|law|permit|permits|compliance|grenseverdi)\b/i;

/**
 * Reads the question and decides what kind of exploration it is.
 * Deterministic on purpose: no model decides what a company is called.
 */
export function parseExploreIntent(question: string): ExploreIntent | null {
  const q = question.trim().replace(/\s+/g, " ");
  if (!q) return null;

  const supplier = SUPPLIER_PATTERN.exec(q) ?? SUPPLIER_PATTERN_LOOSE.exec(q);
  if (supplier && SUPPLIER_WORD.test(q)) {
    const commodity = tidySubject(supplier[1] ?? "");
    const region = tidySubject(supplier[2] ?? "") || null;
    if (commodity) return { kind: "suppliers", commodity, region };
  }

  if (REGULATION_WORDS.test(q) && !/^(?:explore|research|who is|who are)\b/i.test(q)) {
    return { kind: "regulation", topic: tidySubject(q) };
  }

  for (const pattern of COMPANY_LEADS) {
    const match = pattern.exec(q);
    if (match?.[1]) {
      const subject = tidySubject(match[1]);
      if (subject.length >= 2) return { kind: "company", subject };
    }
  }

  // A bare name ("Romerike Biogass", "Tomra Systems ASA") is a company lookup.
  const words = q.split(" ");
  const looksLikeName =
    words.length <= 6 &&
    !/\?$/.test(q) &&
    !/^(?:what|which|who|when|how|show|list|why|where)\b/i.test(q) &&
    /[A-Za-zÆØÅæøå]/.test(q);
  if (looksLikeName) {
    const subject = tidySubject(q);
    if (subject.length >= 2) return { kind: "company", subject };
  }

  return null;
}

/** Short label for the card header. */
export function describeIntent(intent: ExploreIntent): string {
  switch (intent.kind) {
    case "company":
      return `Exploring ${intent.subject}`;
    case "suppliers":
      return intent.region
        ? `${intent.commodity} suppliers near ${intent.region}`
        : `${intent.commodity} suppliers`;
    case "regulation":
      return "Regulatory question";
  }
}
