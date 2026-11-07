const DAY_MS = 86_400_000;

/** Strict YYYY-MM-DD -> UTC timestamp, or null if malformed / not a real date. */
export function parseDate(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const [y, m, d] = value.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return t;
}

export function nightsBetween(checkIn: number, checkOut: number): number {
  return Math.round((checkOut - checkIn) / DAY_MS);
}
