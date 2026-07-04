export interface Env {
  API_SECRET?: string;
  MAX_ENTRIES?: string;
  READ_PUBLIC?: string;
  HEALTH_REFRESH_SECONDS?: string;
  ENTRIES_DO: DurableObjectNamespace;
}

export interface SetupState {
  apiSecret: string;
  revealToken: string | null;
}

export interface CgmEntry {
  _id: string;
  sgv: number;
  date: number;
  dateString: string;
  direction?: string;
  trend?: number;
  type: string;
  device?: string;
  noise?: number;
  filtered?: number;
  unfiltered?: number;
  rssi?: number;
  utcOffset?: number;
  sysTime?: string;
  mills?: number;
  raw?: unknown;
  [key: string]: unknown;
}

export interface EntryQuery {
  count: number;
  onlySgv: boolean;
  currentOnly: boolean;
  dateGte?: number;
  dateLte?: number;
}

export interface EntriesSnapshot {
  count: number;
  last: CgmEntry | null;
  previous: CgmEntry | null;
}

export interface TreatmentsSnapshot {
  count: number;
  last: Treatment | null;
}

export interface NightscoutProfileRecord {
  _id?: string;
  defaultProfile?: string;
  enteredBy?: string;
  startDate?: string;
  created_at?: string;
  store?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Treatment {
  _id: string;
  eventType: string;
  created_at: string;
  mills: number;
  enteredBy?: string;
  notes?: string;
  identifier?: string;
  uuid?: string;
  syncIdentifier?: string;
  [key: string]: unknown;
}

export interface QueryFilter {
  field: string;
  operator: "$eq" | "$gte" | "$lte" | "$gt" | "$lt";
  value: string;
}

export interface TreatmentQuery {
  count: number;
  filters: QueryFilter[];
}

export interface StatusPayload {
  status: "ok";
  name: string;
  version: string;
  serverTime: string;
  apiEnabled: boolean;
  entries: EntriesSnapshot;
}

export interface HealthViewModel {
  latest: CgmEntry | null;
  latestDelta?: number | null;
  count: number;
  latestTreatment?: Treatment | null;
  treatmentCount?: number;
  refreshSeconds?: number;
  baseUrl: string;
  setupSecret?: string | null;
  setupPending?: boolean;
}
