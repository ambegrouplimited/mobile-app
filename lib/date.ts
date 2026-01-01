export function parseISOToDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part) || 0);
  return new Date(year, month - 1, day || 1);
}

export function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatDueDateLabel(value: string) {
  if (!value) return "Add a due date";
  const date = parseISOToDate(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return "Unknown activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown activity";
  }
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) {
    return "Active now";
  }
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
