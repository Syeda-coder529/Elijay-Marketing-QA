// Ringba's Duration column can come as a plain number of seconds ("125"),
// or as "MM:SS" / "HH:MM:SS" time-format strings ("1:05", "01:05:30").
// This normalizes any of those into a plain number of seconds so it can be
// safely compared against numeric thresholds elsewhere in the app.
export function parseDurationToSeconds(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;

  if (typeof raw === "number") return raw;

  const trimmed = raw.trim();

  // Plain number string, e.g. "125"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // "MM:SS" or "HH:MM:SS"
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => parseInt(p, 10) || 0);
    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }
  }

  return 0;
}
