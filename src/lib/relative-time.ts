export function formatRelativeTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value.includes("T") ? value : value.replace(" ", "T")) : value;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 30) return `${diffDay} days ago`;
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function formatDaysAgo(value: string | Date | null): string {
  if (!value) return "No contact recorded";
  const date = typeof value === "string" ? new Date(value.includes("T") ? value : value.replace(" ", "T")) : value;
  const diffDay = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDay === 0) return "Today";
  if (diffDay === 1) return "1 day ago";
  return `${diffDay} days ago`;
}

export function daysBetween(from: string | Date, to: Date = new Date()): number {
  const date = typeof from === "string" ? new Date(from.includes("T") ? from : from.replace(" ", "T")) : from;
  return Math.floor((to.getTime() - date.getTime()) / 86_400_000);
}
