import {
  hasValidSecret,
  optionsResponse,
  requireConfiguredWriteAuth
} from "./auth";
import { EntriesDurableObject } from "./durable-object";
import {
  MAX_REQUEST_BYTES,
  normalizeEntries,
  parseEntryQuery
} from "./entries";
import { renderHealthPage } from "./health";
import { htmlResponse, jsonResponse } from "./responses";
import { normalizeTreatments, parseTreatmentQuery } from "./treatments";
import type {
  CgmEntry,
  Env,
  NightscoutProfileRecord,
  SetupState,
  StatusPayload,
  Treatment,
  TreatmentsSnapshot
} from "./types";

export { EntriesDurableObject };

const APP_NAME = "GlucoEasy";
const APP_VERSION = "0.1.0";
const EMPTY_COLLECTION = [];
const API_BASE_PATHS = new Set(["/api/v1", "/api/v1/"]);
const DEFAULT_HEALTH_REFRESH_SECONDS = 30;

function getHealthLocale(pathname: string): "en" | "es" | null {
  if (pathname === "/health" || pathname === "/setup/acknowledge") {
    return "en";
  }

  if (pathname === "/es/health" || pathname === "/es/setup/acknowledge") {
    return "es";
  }

  return null;
}

function getEntriesStub(env: Env): DurableObjectStub<EntriesDurableObject> {
  const id = env.ENTRIES_DO.idFromName("global");
  return env.ENTRIES_DO.get(id) as DurableObjectStub<EntriesDurableObject>;
}

function getHealthRefreshSeconds(env: Env): number {
  const raw = Number.parseInt(env.HEALTH_REFRESH_SECONDS ?? "", 10);

  if (!Number.isFinite(raw) || raw < 5) {
    return DEFAULT_HEALTH_REFRESH_SECONDS;
  }

  return raw;
}

async function listEntries(env: Env, query: ReturnType<typeof parseEntryQuery>): Promise<CgmEntry[]> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch(
    `https://entries.internal/entries?query=${encodeURIComponent(JSON.stringify(query))}`
  );
  return (await response.json()) as CgmEntry[];
}

async function storeEntries(env: Env, entries: CgmEntry[]): Promise<{ stored: number; total: number }> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries)
  });

  return (await response.json()) as { stored: number; total: number };
}

async function getSnapshot(env: Env): Promise<StatusPayload["entries"]> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/snapshot");
  return (await response.json()) as StatusPayload["entries"];
}

async function getTreatmentsSnapshot(env: Env): Promise<TreatmentsSnapshot> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/treatments/snapshot");
  return (await response.json()) as TreatmentsSnapshot;
}

async function getCurrentProfile(env: Env): Promise<NightscoutProfileRecord> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/profile/current");
  return (await response.json()) as NightscoutProfileRecord;
}

async function listProfiles(env: Env): Promise<NightscoutProfileRecord[]> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/profile");
  return (await response.json()) as NightscoutProfileRecord[];
}

async function listTreatments(env: Env, query: ReturnType<typeof parseTreatmentQuery>): Promise<Treatment[]> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch(
    `https://entries.internal/treatments?query=${encodeURIComponent(JSON.stringify(query))}`
  );
  return (await response.json()) as Treatment[];
}

async function storeTreatments(env: Env, treatments: Treatment[]): Promise<{ stored: number; total: number }> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/treatments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(treatments)
  });

  return (await response.json()) as { stored: number; total: number };
}

async function deleteTreatment(
  env: Env,
  treatmentId: string
): Promise<{ status: "ok"; deleted: boolean; _id: string }> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch(`https://entries.internal/treatments/${encodeURIComponent(treatmentId)}`, {
    method: "DELETE"
  });

  return (await response.json()) as { status: "ok"; deleted: boolean; _id: string };
}

async function storeProfile(env: Env, profile: NightscoutProfileRecord, method: "POST" | "PUT"): Promise<NightscoutProfileRecord> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/profile", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  });

  return (await response.json()) as NightscoutProfileRecord;
}

async function getSetupState(env: Env): Promise<SetupState | null> {
  if (env.API_SECRET) {
    return {
      apiSecret: env.API_SECRET,
      revealToken: null
    };
  }

  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/setup");
  return (await response.json()) as SetupState | null;
}

async function bootstrapSetupState(env: Env): Promise<SetupState> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/setup/bootstrap", {
    method: "POST"
  });
  return (await response.json()) as SetupState;
}

async function acknowledgeSetupState(env: Env, revealToken: string): Promise<boolean> {
  const stub = getEntriesStub(env);
  const response = await stub.fetch("https://entries.internal/setup/acknowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revealToken })
  });
  const payload = (await response.json()) as { acknowledged: boolean };
  return payload.acknowledged;
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=") || null;
    }
  }

  return null;
}

function createSetupCookie(token: string): string {
  return `tinyscout_setup=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`;
}

function clearSetupCookie(): string {
  return "tinyscout_setup=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

async function resolveConfiguredSecret(env: Env): Promise<string | null> {
  if (env.API_SECRET) {
    return env.API_SECRET;
  }

  const state = await getSetupState(env);
  return state?.apiSecret ?? null;
}

async function parsePostBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("Payload too large.");
  }

  return JSON.parse(raw);
}

function isEntriesReadRoute(pathname: string): boolean {
  return [
    "/api/v1/entries",
    "/api/v1/entries.json",
    "/api/v1/entries/sgv",
    "/api/v1/entries/sgv.json",
    "/api/v1/entries/current",
    "/api/v1/entries/current.json"
  ].includes(pathname);
}

function getWriteDebugContext(request: Request, expectedSecret: string | null): Record<string, unknown> {
  const url = new URL(request.url);

  return {
    method: request.method,
    path: url.pathname,
    hasExpectedSecret: Boolean(expectedSecret),
    hasApiSecretHeader: Boolean(request.headers.get("api-secret")),
    hasAuthorizationHeader: Boolean(request.headers.get("Authorization")),
    hasUrlUsername: Boolean(url.username),
    contentType: request.headers.get("Content-Type"),
    contentLength: request.headers.get("Content-Length"),
    userAgent: request.headers.get("User-Agent")
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (url.pathname === "/") {
      return Response.redirect(`${url.origin}/health`, 302);
    }

    const healthLocale = getHealthLocale(url.pathname);

    if (request.method === "POST" && (url.pathname === "/setup/acknowledge" || url.pathname === "/es/setup/acknowledge")) {
      const setupState = await getSetupState(env);
      const cookieToken = getCookie(request, "tinyscout_setup");
      if (!setupState?.revealToken || !cookieToken || cookieToken !== setupState.revealToken) {
        return htmlResponse(
          renderHealthPage({
            latest: null,
            count: 0,
            baseUrl: url.origin,
            setupPending: true
          }, healthLocale ?? "en"),
          {
            status: 403,
            headers: { "Set-Cookie": clearSetupCookie() }
          }
        );
      }

      await acknowledgeSetupState(env, cookieToken);
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${url.origin}${healthLocale === "es" ? "/es/health" : "/health"}`,
          "Set-Cookie": clearSetupCookie()
        }
      });
    }

    if (healthLocale && request.method === "GET" && (url.pathname === "/health" || url.pathname === "/es/health")) {
      let setupState = await getSetupState(env);
      const setupCookie = getCookie(request, "tinyscout_setup");
      let setCookieHeader: string | null = null;

      if (!env.API_SECRET && !setupState) {
        setupState = await bootstrapSetupState(env);
        setCookieHeader = createSetupCookie(setupState.revealToken ?? "");
      }

      const effectiveSetupToken = setupCookie ?? (setCookieHeader ? setupState?.revealToken ?? null : null);
      const expectedSecret = setupState?.apiSecret ?? env.API_SECRET;
      const authError =
        setupState?.revealToken && effectiveSetupToken === setupState.revealToken
          ? null
          : env.READ_PUBLIC?.toLowerCase() === "true"
            ? null
            : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      const snapshot = await getSnapshot(env);
      const treatmentsSnapshot = await getTreatmentsSnapshot(env);
      return htmlResponse(
        renderHealthPage({
          latest: snapshot.last,
          latestDelta:
            snapshot.last && snapshot.previous
              ? snapshot.last.sgv - snapshot.previous.sgv
              : null,
          count: snapshot.count,
          latestTreatment: treatmentsSnapshot.last,
          treatmentCount: treatmentsSnapshot.count,
          refreshSeconds: getHealthRefreshSeconds(env),
          baseUrl: url.origin,
          setupSecret:
            setupState?.revealToken && effectiveSetupToken === setupState.revealToken
              ? setupState.apiSecret
              : null,
          setupPending: Boolean(setupState?.revealToken) && effectiveSetupToken !== setupState?.revealToken
        }, healthLocale),
        setCookieHeader ? { headers: { "Set-Cookie": setCookieHeader } } : undefined
      );
    }

    if (url.pathname === "/api/v1/status.json") {
      const expectedSecret = await resolveConfiguredSecret(env);
      const authError =
        env.READ_PUBLIC?.toLowerCase() === "true"
          ? null
          : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      const snapshot = await getSnapshot(env);
      const payload: StatusPayload = {
        status: "ok",
        name: APP_NAME,
        version: APP_VERSION,
        serverTime: new Date().toISOString(),
        apiEnabled: true,
        entries: snapshot
      };
      return jsonResponse(payload);
    }

    if (request.method === "GET" && API_BASE_PATHS.has(url.pathname)) {
      return jsonResponse({
        status: "ok",
        name: APP_NAME,
        version: APP_VERSION,
        message: "Nightscout-compatible API base. Use /api/v1/status.json or /api/v1/entries.json.",
        endpoints: {
          status: "/api/v1/status.json",
          entries: "/api/v1/entries.json",
          treatments: "/api/v1/treatments.json",
          health: "/health"
        }
      });
    }

    if (request.method === "POST" && ["/api/v1/treatments", "/api/v1/treatments.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const debugContext = getWriteDebugContext(request, expectedSecret);
      if (!expectedSecret) {
        console.warn("Rejected treatment write: setup incomplete", debugContext);
        return jsonResponse(
          { error: "Setup incomplete. Open /health once to generate the API secret." },
          { status: 503 }
        );
      }

      if (!(await hasValidSecret(request, expectedSecret))) {
        console.warn("Rejected treatment write: invalid secret", debugContext);
        const authError = await requireConfiguredWriteAuth(request, expectedSecret);
        if (authError) {
          return authError;
        }
      }

      try {
        const body = await parsePostBody(request);
        const treatments = normalizeTreatments(body);
        const result = await storeTreatments(env, treatments);
        console.log("Stored treatments", { ...debugContext, stored: result.stored, total: result.total });
        return jsonResponse(result);
      } catch (error) {
        console.warn("Rejected treatment write: invalid payload", {
          ...debugContext,
          error: error instanceof Error ? error.message : "Invalid request body."
        });
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Invalid request body." },
          { status: 400 }
        );
      }
    }

    if (request.method === "GET" && ["/api/v1/treatments", "/api/v1/treatments.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const authError =
        env.READ_PUBLIC?.toLowerCase() === "true"
          ? null
          : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      const query = parseTreatmentQuery(url);
      const treatments = await listTreatments(env, query);
      return jsonResponse(treatments);
    }

    if (
      request.method === "DELETE" &&
      (/^\/api\/v1\/treatments\/.+$/.test(url.pathname) || /^\/api\/v1\/treatments\/.+\.json$/.test(url.pathname))
    ) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const debugContext = getWriteDebugContext(request, expectedSecret);
      if (!expectedSecret) {
        console.warn("Rejected treatment delete: setup incomplete", debugContext);
        return jsonResponse(
          { error: "Setup incomplete. Open /health once to generate the API secret." },
          { status: 503 }
        );
      }

      if (!(await hasValidSecret(request, expectedSecret))) {
        console.warn("Rejected treatment delete: invalid secret", debugContext);
        const authError = await requireConfiguredWriteAuth(request, expectedSecret);
        if (authError) {
          return authError;
        }
      }

      const treatmentId = decodeURIComponent(
        url.pathname
          .replace(/^\/api\/v1\/treatments\//, "")
          .replace(/\.json$/, "")
      );
      const result = await deleteTreatment(env, treatmentId);
      console.log("Processed treatment delete", { ...debugContext, treatmentId, deleted: result.deleted });
      return jsonResponse(result);
    }

    if (request.method === "GET" && ["/api/v1/profile/current", "/api/v1/profile/current.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const authError =
        env.READ_PUBLIC?.toLowerCase() === "true"
          ? null
          : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      const profile = await getCurrentProfile(env);
      return jsonResponse(profile);
    }

    if (request.method === "GET" && ["/api/v1/profile", "/api/v1/profile.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const authError =
        env.READ_PUBLIC?.toLowerCase() === "true"
          ? null
          : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      const profiles = await listProfiles(env);
      return jsonResponse(profiles);
    }

    if (["POST", "PUT"].includes(request.method) && ["/api/v1/profile", "/api/v1/profile.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const debugContext = getWriteDebugContext(request, expectedSecret);
      if (!expectedSecret) {
        console.warn("Rejected profile write: setup incomplete", debugContext);
        return jsonResponse(
          { error: "Setup incomplete. Open /health once to generate the API secret." },
          { status: 503 }
        );
      }

      if (!(await hasValidSecret(request, expectedSecret))) {
        console.warn("Rejected profile write: invalid secret", debugContext);
        const authError = await requireConfiguredWriteAuth(request, expectedSecret);
        if (authError) {
          return authError;
        }
      }

      try {
        const body = (await parsePostBody(request)) as NightscoutProfileRecord;
        const profile = await storeProfile(env, body, request.method as "POST" | "PUT");
        console.log("Stored profile", {
          ...debugContext,
          defaultProfile: profile.defaultProfile,
          profileCount: Object.keys(profile.store ?? {}).length
        });
        return jsonResponse(profile);
      } catch (error) {
        console.warn("Rejected profile write: invalid payload", {
          ...debugContext,
          error: error instanceof Error ? error.message : "Invalid request body."
        });
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Invalid request body." },
          { status: 400 }
        );
      }
    }

    if (request.method === "GET" && ["/api/v1/devicestatus", "/api/v1/devicestatus.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const authError =
        env.READ_PUBLIC?.toLowerCase() === "true"
          ? null
          : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      return jsonResponse(EMPTY_COLLECTION);
    }

    if (request.method === "POST" && ["/api/v1/entries", "/api/v1/entries.json"].includes(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const debugContext = getWriteDebugContext(request, expectedSecret);
      if (!expectedSecret) {
        console.warn("Rejected entry write: setup incomplete", debugContext);
        return jsonResponse(
          { error: "Setup incomplete. Open /health once to generate the API secret." },
          { status: 503 }
        );
      }

      if (!(await hasValidSecret(request, expectedSecret))) {
        console.warn("Rejected entry write: invalid secret", debugContext);
        const authError = await requireConfiguredWriteAuth(request, expectedSecret);
        if (authError) {
          return authError;
        }
      }

      try {
        const body = await parsePostBody(request);
        const entries = normalizeEntries(body);
        const result = await storeEntries(env, entries);
        console.log("Stored entries", { ...debugContext, stored: result.stored, total: result.total });
        return jsonResponse(result);
      } catch (error) {
        console.warn("Rejected entry write: invalid payload", {
          ...debugContext,
          error: error instanceof Error ? error.message : "Invalid request body."
        });
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Invalid request body." },
          { status: 400 }
        );
      }
    }

    if (request.method === "GET" && isEntriesReadRoute(url.pathname)) {
      const expectedSecret = await resolveConfiguredSecret(env);
      const authError =
        env.READ_PUBLIC?.toLowerCase() === "true"
          ? null
          : await requireConfiguredWriteAuth(request, expectedSecret);
      if (authError) {
        return authError;
      }

      const query = parseEntryQuery(
        url,
        url.pathname.includes("/current"),
        url.pathname.includes("/sgv")
      );
      const entries = await listEntries(env, query);
      return jsonResponse(entries);
    }

    return jsonResponse({ error: "Not found" }, { status: 404 });
  }
};
