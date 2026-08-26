/** Shared legal-form stripping for registry name matching. */

export const LEGAL_FORM_SUFFIX_RE =
  /\b(ab|hb|kb|as|asa|oy|a\/s|gmbh|ag|aktiengesellschaft|se|s\.?\s*a\.?u?\.?|s\.?\s*l\.?u?\.?|s\.?\s*r\.?\s*l\.?|s\.?\s*p\.?\s*a\.?|srl|spa|b\.?\s*v\.?|n\.?\s*v\.?|ltd\.?|limited|plc|llp|lda\.?|kg|ohg|ug|s\.?\s*à\s*r\.?\s*l\.?|sarl|sàrl|sas|e\.?\s*k\.?|e\.?\s*u\.?)\b/gi;

export function stripLegalForm(query: string): string {
  return query.replace(LEGAL_FORM_SUFFIX_RE, " ").replace(/\s+/g, " ").trim();
}

export function foldRegistryName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}
