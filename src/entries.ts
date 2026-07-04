import type { CgmEntry, EntryQuery } from "./types";

export const DEFAULT_MAX_ENTRIES = 2000;
export const DEFAULT_QUERY_COUNT = 10;
export const MAX_REQUEST_BYTES = 256 * 1024;

function parseEpoch(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeDateString(date: number, dateString: unknown): string {
  if (typeof dateString === "string" && dateString.trim() !== "") {
    const parsed = Date.parse(dateString);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date(date).toISOString();
}

export function normalizeEntry(input: unknown): CgmEntry {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Entry must be an object.");
  }

  const candidate = { ...(input as Record<string, unknown>) };
  const rawSgv = candidate.sgv;
  const sgv = typeof rawSgv === "number" ? rawSgv : Number(rawSgv);
  if (!Number.isFinite(sgv)) {
    throw new Error("Entry must include a numeric sgv.");
  }

  const date = parseEpoch(candidate.date) ?? parseEpoch(candidate.dateString);
  if (date === null) {
    throw new Error("Entry must include date or dateString.");
  }

  const normalized: CgmEntry = {
    ...candidate,
    _id:
      typeof candidate._id === "string" && candidate._id.trim() !== ""
        ? candidate._id
        : String(date),
    sgv,
    date,
    dateString: normalizeDateString(date, candidate.dateString),
    type:
      typeof candidate.type === "string" && candidate.type.trim() !== ""
        ? candidate.type
        : "sgv",
    device:
      typeof candidate.device === "string" && candidate.device.trim() !== ""
        ? candidate.device
        : "xDrip"
  };

  return normalized;
}

export function normalizeEntries(input: unknown): CgmEntry[] {
  if (Array.isArray(input)) {
    return input.map(normalizeEntry);
  }

  return [normalizeEntry(input)];
}

export function clampMaxEntries(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_ENTRIES;
  }

  return Math.floor(parsed);
}

export function mergeEntries(
  existing: CgmEntry[],
  incoming: CgmEntry[],
  maxEntries: number
): CgmEntry[] {
  const byId = new Map<string, CgmEntry>();
  const byDate = new Map<number, CgmEntry>();

  for (const entry of [...incoming, ...existing]) {
    if (byId.has(entry._id) || byDate.has(entry.date)) {
      continue;
    }

    byId.set(entry._id, entry);
    byDate.set(entry.date, entry);
  }

  return [...byId.values()]
    .sort((left, right) => right.date - left.date)
    .slice(0, maxEntries);
}

export function parseEntryQuery(url: URL, currentOnly = false, onlySgv = false): EntryQuery {
  const countValue = Number(url.searchParams.get("count") ?? DEFAULT_QUERY_COUNT);
  const count = Number.isFinite(countValue) && countValue > 0 ? Math.floor(countValue) : DEFAULT_QUERY_COUNT;
  const dateGte = parseEpoch(url.searchParams.get("find[date][$gte]"));
  const dateLte = parseEpoch(url.searchParams.get("find[date][$lte]"));

  return {
    count,
    currentOnly,
    onlySgv,
    dateGte: dateGte ?? undefined,
    dateLte: dateLte ?? undefined
  };
}

export function queryEntries(entries: CgmEntry[], query: EntryQuery): CgmEntry[] {
  let results = [...entries];

  if (query.onlySgv) {
    results = results.filter((entry) => entry.type === "sgv");
  }

  if (query.dateGte !== undefined) {
    results = results.filter((entry) => entry.date >= query.dateGte!);
  }

  if (query.dateLte !== undefined) {
    results = results.filter((entry) => entry.date <= query.dateLte!);
  }

  const limit = query.currentOnly ? 1 : query.count;
  return results.slice(0, limit);
}
