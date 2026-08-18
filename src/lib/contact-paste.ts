import { isInternalEmail } from "@/lib/domain-rules";
import { parsePersonName } from "@/lib/m365/outlook-sender-utils";
import {
  parseSignatureIntelligence,
  parseSignaturePersonName,
} from "@/lib/m365/signature-intelligence";
import type { CreateContactInput } from "@/types/contact";

const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LINKEDIN_IN_TEXT = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i;

export type ContactPasteResult = {
  next: CreateContactInput;
  filled: string[];
  error: string | null;
};

/**
 * Fill a contact form from pasted website / signature text.
 * Reality First: only detected fields; never invent buying role or company.
 */
export function fillContactFormFromPastedText(
  form: CreateContactInput,
  rawText: string,
): ContactPasteResult {
  const text = rawText.trim();
  if (!text) {
    return { next: form, filled: [], error: null };
  }

  const enrichment = parseSignatureIntelligence(text);
  const byId = Object.fromEntries(enrichment.suggestions.map((row) => [row.id, row.value]));
  const emailMatch = text.match(EMAIL_IN_TEXT);
  const email = (byId.email ?? emailMatch?.[0] ?? "").trim().toLowerCase();

  if (email && isInternalEmail(email)) {
    return {
      next: form,
      filled: [],
      error: "Standard Bio colleagues are users, not contacts. Add them in Users & Access.",
    };
  }

  const personName = parseSignaturePersonName(text, email || undefined);
  const parsedName = parsePersonName(personName ?? "", email);
  const linkedInMatch = text.match(LINKEDIN_IN_TEXT);

  const next: CreateContactInput = { ...form };
  const filled: string[] = [];

  const apply = (label: string, hasValue: boolean, write: () => void) => {
    if (!hasValue) return;
    write();
    filled.push(label);
  };

  apply("First name", Boolean(personName && parsedName.firstName), () => {
    next.FirstName = parsedName.firstName;
  });
  apply("Last name", Boolean(personName && parsedName.lastName), () => {
    next.LastName = parsedName.lastName;
  });
  apply("Job title", Boolean(byId.jobTitle), () => {
    next.JobTitle = byId.jobTitle!;
  });
  apply("Email", Boolean(email), () => {
    next.Email = email;
  });
  apply("Mobile", Boolean(byId.mobile), () => {
    next.Mobile = byId.mobile!;
  });
  apply("Phone", Boolean(byId.phone), () => {
    next.Phone = byId.phone!;
  });
  apply("LinkedIn", Boolean(linkedInMatch?.[0]), () => {
    const href = linkedInMatch![0]!;
    next.LinkedInURL = href.startsWith("http") ? href : `https://${href}`;
  });
  apply("Address", Boolean(byId.address), () => {
    next.streetAddress = byId.address!;
  });

  if (filled.length === 0) {
    return {
      next: form,
      filled: [],
      error: "Could not read a name, email, or phone from that text.",
    };
  }

  return { next, filled, error: null };
}
