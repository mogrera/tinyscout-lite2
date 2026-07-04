import type { QueryFilter, Treatment, TreatmentQuery } from "./types";

export const DEFAULT_QUERY_COUNT = 10;
export const DEFAULT_TREATMENT_LOOKBACK_HOURS = 24;
export const DEFAULT_TREATMENT_LOOKBACK_COUNT = 1000;

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

function normalizeCreatedAt(value: unknown, fallbackEpoch: number): string {
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date(fallbackEpoch).toISOString();
}

function stableFallbackId(candidate: Record<string, unknown>, mills: number, eventType: string): string {
  const enteredBy = typeof candidate.enteredBy === "string" ? candidate.enteredBy : "";
  const notes = typeof candidate.notes === "string" ? candidate.notes : "";
  return `${mills}:${eventType}:${enteredBy}:${notes}`;
}

function normalizeId(candidate: Record<string, unknown>, mills: number, eventType: string): string {
  for (const field of ["_id", "identifier", "uuid", "syncIdentifier"]) {
    const value = candidate[field];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return stableFallbackId(candidate, mills, eventType);
}

export function normalizeTreatment(input: unknown): Treatment {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Treatment must be an object.");
  }

  const candidate = { ...(input as Record<string, unknown>) };
  const sourceEpoch =
    parseEpoch(candidate.created_at) ??
    parseEpoch(candidate.mills) ??
    parseEpoch(candidate.timestamp) ??
    parseEpoch(candidate.date) ??
    parseEpoch(candidate.dateString);
  if (sourceEpoch === null) {
    throw new Error("Treatment must include created_at, mills, timestamp, date, or dateString.");
  }

  const createdAt = normalizeCreatedAt(candidate.created_at, sourceEpoch);
  const mills = Date.parse(createdAt);
  const nowIso = new Date().toISOString();
  const eventType =
    typeof candidate.eventType === "string" && candidate.eventType.trim() !== ""
      ? candidate.eventType
      : "";

  return {
    ...candidate,
    _id: normalizeId(candidate, mills, eventType),
    eventType,
    created_at: createdAt,
    mills,
    srvCreated: normalizeCreatedAt(candidate.srvCreated, Date.parse(nowIso)),
    srvModified: normalizeCreatedAt(candidate.srvModified, Date.parse(nowIso)),
    enteredBy:
      typeof candidate.enteredBy === "string" && candidate.enteredBy.trim() !== ""
        ? candidate.enteredBy
        : undefined,
    notes:
      typeof candidate.notes === "string" && candidate.notes.trim() !== ""
        ? candidate.notes
        : undefined
  };
}

export function normalizeTreatments(input: unknown): Treatment[] {
  if (Array.isArray(input)) {
    return input.map(normalizeTreatment);
  }

  return [normalizeTreatment(input)];
}

function treatmentKeys(treatment: Treatment): string[] {
  const keys = [
    treatment._id,
    typeof treatment.identifier === "string" ? treatment.identifier : null,
    typeof treatment.uuid === "string" ? treatment.uuid : null,
    typeof treatment.syncIdentifier === "string" ? treatment.syncIdentifier : null,
    `${treatment.created_at}:${treatment.eventType}`
  ];

  return keys.filter((value): value is string => Boolean(value && value.trim() !== ""));
}

export function mergeTreatments(existing: Treatment[], incoming: Treatment[], maxEntries: number): Treatment[] {
  const seen = new Set<string>();
  const merged: Treatment[] = [];

  for (const treatment of [...incoming, ...existing]) {
    const keys = treatmentKeys(treatment);
    if (keys.some((key) => seen.has(key))) {
      continue;
    }

    for (const key of keys) {
      seen.add(key);
    }

    merged.push(treatment);
  }

  return merged
    .sort((left, right) => right.mills - left.mills)
    .slice(0, maxEntries);
}

function parseCount(url: URL): number {
  const countValue = Number(url.searchParams.get("count") ?? DEFAULT_QUERY_COUNT);
  return Number.isFinite(countValue) && countValue > 0 ? Math.floor(countValue) : DEFAULT_QUERY_COUNT;
}

export function parseTreatmentQuery(url: URL): TreatmentQuery {
  const filters: QueryFilter[] = [];

  for (const [key, value] of url.searchParams.entries()) {
    const match = key.match(/^find\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (!match) {
      continue;
    }

    const [, field, rawOperator] = match;
    const operator = rawOperator ?? "$eq";
    if (!["$eq", "$gte", "$lte", "$gt", "$lt"].includes(operator)) {
      continue;
    }

    filters.push({
      field,
      operator: operator as QueryFilter["operator"],
      value
    });
  }

  const hasDateFilter = filters.some((filter) =>
    ["mills", "created_at", "timestamp", "date", "dateString"].includes(filter.field)
  );
  const hasExplicitCount = url.searchParams.has("count");
  const count = hasExplicitCount ? parseCount(url) : DEFAULT_TREATMENT_LOOKBACK_COUNT;

  if (!hasDateFilter) {
    filters.push({
      field: "mills",
      operator: "$gte",
      value: String(Date.now() - DEFAULT_TREATMENT_LOOKBACK_HOURS * 60 * 60 * 1000)
    });
  }

  return {
    count,
    filters
  };
}

function compareValues(recordValue: unknown, operator: QueryFilter["operator"], queryValue: string): boolean {
  if (recordValue === undefined || recordValue === null) {
    return false;
  }

  const recordEpoch = parseEpoch(recordValue);
  const queryEpoch = parseEpoch(queryValue);
  if (recordEpoch !== null && queryEpoch !== null) {
    if (operator === "$eq") return recordEpoch === queryEpoch;
    if (operator === "$gte") return recordEpoch >= queryEpoch;
    if (operator === "$lte") return recordEpoch <= queryEpoch;
    if (operator === "$gt") return recordEpoch > queryEpoch;
    return recordEpoch < queryEpoch;
  }

  if (typeof recordValue === "number") {
    const numeric = Number(queryValue);
    if (!Number.isFinite(numeric)) {
      return false;
    }

    if (operator === "$eq") return recordValue === numeric;
    if (operator === "$gte") return recordValue >= numeric;
    if (operator === "$lte") return recordValue <= numeric;
    if (operator === "$gt") return recordValue > numeric;
    return recordValue < numeric;
  }

  const left = String(recordValue);
  if (operator === "$eq") {
    return left === queryValue;
  }

  const comparison = left.localeCompare(queryValue);
  if (operator === "$gte") return comparison >= 0;
  if (operator === "$lte") return comparison <= 0;
  if (operator === "$gt") return comparison > 0;
  return comparison < 0;
}

export function queryTreatments(treatments: Treatment[], query: TreatmentQuery): Treatment[] {
  const filtered = treatments.filter((treatment) =>
    query.filters.every((filter) => compareValues(treatment[filter.field], filter.operator, filter.value))
  );

  return filtered.slice(0, query.count);
}
