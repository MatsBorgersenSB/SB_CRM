/** Split pasted text into individual company/contact blocks. */
export function splitBulkImportBlocks(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
}
