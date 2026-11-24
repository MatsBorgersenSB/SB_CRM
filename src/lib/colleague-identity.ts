import type { AuthUser } from "@/types/auth";
import type { SharePointPerson } from "@/types/sharepoint";
import { STANDARD_BIO_USERS } from "@/types/bio-user";

/** Keep in sync with company-owner CANONICAL_USER_EMAILS. */
const CANONICAL_EMAILS: Record<number, string> = {
  1: "mats.borgersen@standard.bio",
  100: "walter.aker@standard.bio",
  101: "hugo.jansson@standard.bio",
  102: "okr@standard.bio",
  103: "bjorn.molskred@standard.bio",
};

export type ColleagueIdentity = {
  id?: number | null;
  title?: string | null;
  email?: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeTitle(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/** Prefer Email on the person; fall back to canonical directory by id. */
export function personEmail(
  person: (Pick<SharePointPerson, "Id"> & Partial<Pick<SharePointPerson, "Email" | "Title">>) | null | undefined,
): string {
  const direct = normalizeEmail(person?.Email);
  if (direct && !direct.endsWith("@smartcrm.local")) return direct;
  if (person?.Id != null && person.Id > 0) {
    return normalizeEmail(CANONICAL_EMAILS[person.Id]);
  }
  return "";
}

/**
 * Match a stored person to the signed-in colleague.
 * Order: email → id>0 → display title (never title alone when email/id can decide).
 */
export function personMatchesColleague(
  person: SharePointPerson | null | undefined,
  colleague: ColleagueIdentity,
): boolean {
  if (!person) return false;

  const colleagueEmail = normalizeEmail(colleague.email);
  const personMail = personEmail(person);
  if (colleagueEmail && !colleagueEmail.endsWith("@smartcrm.local") && personMail) {
    return personMail === colleagueEmail;
  }

  const colleagueId =
    colleague.id != null && Number.isFinite(colleague.id) && colleague.id > 0
      ? colleague.id
      : null;
  if (colleagueId != null && person.Id > 0) {
    return person.Id === colleagueId;
  }

  const colleagueTitle = normalizeTitle(colleague.title);
  const personTitle = normalizeTitle(person.Title);
  if (colleagueTitle && personTitle) {
    return colleagueTitle === personTitle;
  }

  return false;
}

export function authUserAsColleague(user: Pick<AuthUser, "id" | "displayName" | "email">): ColleagueIdentity {
  return {
    id: user.id > 0 ? user.id : null,
    title: user.displayName,
    email: user.email ?? null,
  };
}

/** Attach known email onto a person for pickers / notify without inventing people. */
export function withPersonEmail(person: SharePointPerson): SharePointPerson {
  if (person.Email?.trim()) return person;
  const email = personEmail(person);
  return email ? { ...person, Email: email } : person;
}

export function enrichPersonFromCanonical(person: SharePointPerson | null | undefined): SharePointPerson | null {
  if (!person) return null;
  if (person.Id > 0) {
    const known = STANDARD_BIO_USERS.find((entry) => entry.Id === person.Id);
    const email = CANONICAL_EMAILS[person.Id] || person.Email;
    if (known) {
      return {
        Id: known.Id,
        Title: known.Title || person.Title,
        Email: email,
      };
    }
  }
  return withPersonEmail(person);
}
