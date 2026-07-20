import type { AuthUser } from "@/types/auth";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  SearchEntityType,
  SearchIndexItem,
  SearchResultGroup,
} from "@/types/universal-search";
import { SEARCH_GROUP_LABELS, SEARCH_GROUP_ORDER } from "@/types/universal-search";

const MAX_PER_GROUP = 5;
const MAX_TOTAL = 28;

function scoreItem(item: SearchIndexItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = item.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;

  const type = item.typeLabel.toLowerCase();
  if (type.includes(q)) return 40;

  if (item.searchText.includes(q)) return 30;

  const tokens = q.split(/\s+/).filter(Boolean);
  const matchedTokens = tokens.filter((t) => item.searchText.includes(t)).length;
  return matchedTokens * 10;
}

export function filterSearchIndexForUser(
  items: SearchIndexItem[],
  user: AuthUser,
  companies: Company[],
  pipelines: PipelineRow[],
): SearchIndexItem[] {
  if (user.role !== "client_lead" || !user.companyId) return items;

  const scopedCompanies = filterCompaniesForUser(companies, user);
  const scopedPipelines = filterPipelinesForUser(pipelines, user, companies);
  const companyIds = new Set(scopedCompanies.map((c) => c.CompanyID));
  const companyTitles = new Set(scopedCompanies.map((c) => c.Title.toLowerCase()));
  const dealIds = new Set(scopedPipelines.map((p) => p.id));
  const contactIds = new Set(
    scopedCompanies.flatMap((c) => c.contacts.map((ct) => ct.ContactID)),
  );

  return items.filter((item) => {
    switch (item.entityType) {
      case "company":
        return companyIds.has(item.id.replace("company-", ""));
      case "contact":
        return contactIds.has(item.id.replace("contact-", ""));
      case "deal":
        return dealIds.has(item.id.replace("deal-", ""));
      case "activity":
      case "note":
        return scopedCompanies.some(
          (c) =>
            item.contextPreview.includes(c.Title) ||
            item.searchText.includes(c.Title.toLowerCase()),
        );
      case "document":
      case "document_set":
      case "transmission":
        return scopedPipelines.some(
          (p) =>
            item.contextPreview.includes(p.id) || item.searchText.includes(p.id.toLowerCase()),
        );
      case "attention":
        return (
          (item.smartMeta?.companyId && companyIds.has(item.smartMeta.companyId)) ||
          [...companyTitles].some((title) => item.searchText.includes(title))
        );
      case "raw_material":
        return false;
      default:
        return false;
    }
  });
}

export function querySearchIndex(
  items: SearchIndexItem[],
  query: string,
): SearchResultGroup[] {
  const q = query.trim();
  if (!q) return getSuggestedSearchResults(items);

  const scored = items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  return groupSearchItems(scored.map((entry) => entry.item));
}

/** Recent / high-signal items when palette opens — enables two-click navigation. */
export function getSuggestedSearchResults(items: SearchIndexItem[]): SearchResultGroup[] {
  const withDates = items.filter((item) => item.lastActivityAt);
  const sorted = [...withDates].sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );

  const picked: SearchIndexItem[] = [];
  const seenTypes = new Set<SearchEntityType>();

  for (const item of sorted) {
    if (picked.length >= MAX_TOTAL) break;
    if (
      seenTypes.has(item.entityType) &&
      picked.filter((p) => p.entityType === item.entityType).length >= 2
    ) {
      continue;
    }
    picked.push(item);
    seenTypes.add(item.entityType);
  }

  if (picked.length < 8) {
    const attention = items.filter((item) => item.entityType === "attention").slice(0, 3);
    for (const item of attention) {
      if (picked.some((p) => p.id === item.id)) continue;
      picked.push(item);
    }
  }

  if (picked.length < 10) {
    for (const item of items) {
      if (picked.length >= MAX_TOTAL) break;
      if (picked.some((p) => p.id === item.id)) continue;
      picked.push(item);
    }
  }

  return groupSearchItems(picked);
}

function groupSearchItems(items: SearchIndexItem[]): SearchResultGroup[] {
  const grouped = new Map<SearchEntityType, SearchIndexItem[]>();
  let total = 0;

  for (const item of items) {
    if (total >= MAX_TOTAL) break;
    const bucket = grouped.get(item.entityType) ?? [];
    if (bucket.length >= MAX_PER_GROUP) continue;
    bucket.push(item);
    grouped.set(item.entityType, bucket);
    total += 1;
  }

  return SEARCH_GROUP_ORDER.flatMap((entityType) => {
    const groupItems = grouped.get(entityType);
    if (!groupItems?.length) return [];
    return [
      {
        entityType,
        label: SEARCH_GROUP_LABELS[entityType],
        items: groupItems,
      },
    ];
  });
}

export function flattenSearchGroups(groups: SearchResultGroup[]): SearchIndexItem[] {
  return groups.flatMap((group) => group.items);
}

export function topScoredItems(items: SearchIndexItem[], query: string, limit = 12): SearchIndexItem[] {
  const q = query.trim();
  if (!q) return [];

  return items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
