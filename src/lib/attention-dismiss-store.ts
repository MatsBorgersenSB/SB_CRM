/**
 * Persist Attention "No Action" dismissals so items leave the queue
 * until the underlying signal changes (new id) or the user clears storage.
 */

const STORAGE_KEY = "smartcrm-attention-dismissed";

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readIds(): string[] {
  const storage = readStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  const storage = readStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function isAttentionItemDismissed(id: string): boolean {
  return readIds().includes(id);
}

export function listDismissedAttentionIds(): string[] {
  return readIds();
}

/** User chose No Action — hide this attention item from queues. */
export function dismissAttentionItem(id: string): void {
  if (!id) return;
  const ids = readIds();
  if (ids.includes(id)) return;
  ids.push(id);
  writeIds(ids);
}

export function filterDismissedAttentionItems<T extends { id: string }>(items: T[]): T[] {
  const dismissed = new Set(readIds());
  if (dismissed.size === 0) return items;
  return items.filter((item) => !dismissed.has(item.id));
}
