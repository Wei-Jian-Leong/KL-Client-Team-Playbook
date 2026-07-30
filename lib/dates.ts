/**
 * Parse a "YYYY-MM-DD" string as UTC noon so the calendar date is identical
 * in every timezone (UTC noon = EST 7am = MYT 8pm — all same date).
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Serialise a Date back to "YYYY-MM-DD" using its UTC date parts.
 * Safe for dates stored as UTC noon.
 */
export function toInputDate(date: Date | string): string {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date for display in New York time. */
export function formatNYDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

/** Compute the first Monday of a given month (UTC-safe). */
export function firstMondayOfMonth(year: number, month: number): Date {
  // month is 1-based
  const d = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon …
  const diff = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  d.setUTCDate(1 + diff);
  return d;
}
