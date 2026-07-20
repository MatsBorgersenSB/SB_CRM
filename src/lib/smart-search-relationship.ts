import type { SearchIndexItem, RelationshipSearchBundle } from "@/types/universal-search";

function companyIdFromItem(item: SearchIndexItem): string | null {
  if (item.entityType === "company") return item.id.replace("company-", "");
  return item.smartMeta?.companyId ?? null;
}

export function buildRelationshipBundles(
  items: SearchIndexItem[],
  query: string,
  allItems: SearchIndexItem[],
  limit = 2,
): RelationshipSearchBundle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const companyMatches = items
    .filter((item) => item.entityType === "company")
    .slice(0, limit);

  return companyMatches.map((companyItem) => {
    const companyId = companyIdFromItem(companyItem)!;
    const meta = companyItem.smartMeta;

    const contacts = allItems
      .filter((item) => item.entityType === "contact" && item.searchText.includes(companyItem.name.toLowerCase()))
      .slice(0, 4);

    const opportunities = allItems
      .filter((item) => item.entityType === "deal" && item.contextPreview.toLowerCase().includes(companyItem.name.toLowerCase()))
      .slice(0, 4);

    const documents = allItems
      .filter(
        (item) =>
          (item.entityType === "document" || item.entityType === "document_set") &&
          item.contextPreview.toLowerCase().includes(companyItem.name.toLowerCase()),
      )
      .slice(0, 3);

    const attentionItems = allItems
      .filter(
        (item) =>
          item.entityType === "attention" &&
          (item.smartMeta?.companyId === companyId ||
            item.contextPreview.toLowerCase().includes(companyItem.name.toLowerCase())),
      )
      .slice(0, 3);

    return {
      companyId,
      companyName: companyItem.name,
      locationLabel: meta?.locationLabel ?? companyItem.contextPreview,
      openOpportunities: meta?.openOpportunities ?? opportunities.length,
      contactCount: meta?.contactCount ?? contacts.length,
      pipelineValueLabel: meta?.pipelineValueLabel ?? "—",
      attentionCount: meta?.attentionCount ?? attentionItems.length,
      href: companyItem.href,
      contacts,
      opportunities,
      documents,
      attentionItems,
    };
  });
}
