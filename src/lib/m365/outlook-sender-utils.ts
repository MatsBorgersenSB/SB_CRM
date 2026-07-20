export function extractEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  return parts[1] ?? "";
}

export function parsePersonName(
  displayName: string,
  email: string,
): {
  firstName: string;
  lastName: string;
  displayName: string;
} {
  const trimmed = displayName.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0]!, lastName: "", displayName: trimmed };
    }
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(" "),
      displayName: trimmed,
    };
  }

  const local = email.split("@")[0] ?? "";
  const fromLocal = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  if (!fromLocal) {
    return { firstName: "Contact", lastName: "", displayName: email };
  }

  const nameParts = fromLocal.split(/\s+/);
  return {
    firstName: nameParts[0] ?? fromLocal,
    lastName: nameParts.slice(1).join(" "),
    displayName: fromLocal,
  };
}

export function domainToSuggestedCompanyName(domain: string): string {
  if (!domain) return "";
  const root = domain.split(".")[0] ?? domain;
  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
