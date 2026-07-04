import { SELF, env, reset } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(async () => {
  vi.useRealTimers();
  await reset();
});

async function initializeSetup(): Promise<{ secret: string; cookie: string }> {
  const response = await SELF.fetch("https://example.com/health");
  expect(response.status).toBe(200);

  const cookie = response.headers.get("Set-Cookie");
  expect(cookie).toContain("tinyscout_setup=");

  const html = await response.text();
  const secretMatch = html.match(/<code>([a-z2-9]{6})<\/code>/);
  expect(secretMatch?.[1]).toBeTruthy();

  return {
    secret: secretMatch![1],
    cookie: cookie!.split(";", 1)[0]
  };
}

async function acknowledgeSetup(cookie: string) {
  const response = await SELF.fetch("https://example.com/setup/acknowledge", {
    method: "POST",
    headers: { Cookie: cookie },
    redirect: "manual"
  });
  expect(response.status).toBe(303);
}

function secretHeader(secret: string): HeadersInit {
  return { "api-secret": secret };
}

async function sha1(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function postEntries(body: unknown, headers: HeadersInit) {
  return SELF.fetch("https://example.com/api/v1/entries.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

async function postTreatments(body: unknown, headers: HeadersInit) {
  return SELF.fetch("https://example.com/api/v1/treatments.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

async function deleteTreatment(id: string, headers: HeadersInit) {
  return SELF.fetch(`https://example.com/api/v1/treatments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers
  });
}

async function postProfile(body: unknown, headers: HeadersInit, method: "POST" | "PUT" = "POST") {
  return SELF.fetch("https://example.com/api/v1/profile", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

describe("api", () => {
  it("generates the setup secret on first health visit and reveals it once", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const secondResponse = await SELF.fetch("https://example.com/health", {
      headers: secretHeader(secret)
    });
    expect(secondResponse.status).toBe(200);
    const secondHtml = await secondResponse.text();
    expect(secondHtml).not.toContain(secret);

    const postResponse = await postEntries(
      { sgv: 143, date: 2781111111111 },
      secretHeader(secret)
    );
    expect(postResponse.status).toBe(200);
  });

  it("rejects POST without API secret", async () => {
    const { cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const response = await SELF.fetch("https://example.com/api/v1/entries.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sgv: 143, date: 1781111111111 })
    });

    expect(response.status).toBe(401);
  });

  it("accepts xDrip-style SHA1 api-secret headers", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const response = await postEntries(
      { sgv: 143, date: 2781111111111 },
      secretHeader(await sha1(secret))
    );

    expect(response.status).toBe(200);
  });

  it("accepts single-object POST and returns current entry", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const postResponse = await postEntries({
      sgv: 143,
      date: 2781111111111,
      direction: "Flat",
      type: "sgv",
      device: "xDrip"
    }, secretHeader(secret));

    expect(postResponse.status).toBe(200);

    const currentResponse = await SELF.fetch(
      "https://example.com/api/v1/entries/current.json",
      { headers: secretHeader(secret) }
    );
    expect(currentResponse.status).toBe(200);

    const current = (await currentResponse.json()) as Array<{ sgv: number }>;
    expect(current).toHaveLength(1);
    expect(current[0].sgv).toBe(143);
  });

  it("accepts arrays, deduplicates, and limits count", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    await postEntries([
      { sgv: 140, date: 1781111112112, type: "sgv" },
      { sgv: 141, date: 1781111112113, type: "sgv" },
      { sgv: 141, date: 1781111112113, type: "sgv" }
    ], secretHeader(secret));

    const response = await SELF.fetch(
      "https://example.com/api/v1/entries.json?count=2",
      { headers: secretHeader(secret) }
    );

    const entries = (await response.json()) as Array<{ date: number }>;
    expect(entries).toHaveLength(2);
    expect(entries[0].date).toBeGreaterThan(entries[1].date);
  });

  it("filters sgv entries and date ranges", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    await postEntries([
      { sgv: 120, date: 1781111113100, type: "mbg" },
      { sgv: 121, date: 1781111113200, type: "sgv" },
      { sgv: 122, date: 1781111113300, type: "sgv" }
    ], secretHeader(secret));

    const response = await SELF.fetch(
      "https://example.com/api/v1/entries/sgv.json?find[date][$gte]=1781111113250",
      { headers: secretHeader(secret) }
    );

    const entries = (await response.json()) as Array<{ date: number; type: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("sgv");
    expect(entries[0].date).toBe(1781111113300);
  });

  it("stores and queries treatments", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const postResponse = await postTreatments([
      {
        eventType: "Carb Correction",
        created_at: "2026-06-10T20:00:00.000Z",
        carbs: 12,
        notes: "Juice"
      },
      {
        eventType: "Correction Bolus",
        created_at: "2026-06-10T20:05:00.000Z",
        insulin: 1.2,
        enteredBy: "xDrip"
      }
    ], secretHeader(secret));

    expect(postResponse.status).toBe(200);

    const treatmentsResponse = await SELF.fetch(
      "https://example.com/api/v1/treatments.json?count=1&find[eventType]=Correction%20Bolus&find[mills][$gte]=1781120000000",
      { headers: secretHeader(secret) }
    );
    expect(treatmentsResponse.status).toBe(200);

    const treatments = (await treatmentsResponse.json()) as Array<{ eventType: string; mills: number }>;
    expect(treatments).toHaveLength(1);
    expect(treatments[0].eventType).toBe("Correction Bolus");
    expect(treatments[0].mills).toBe(1781121900000);
  });

  it("returns only treatments from the last 24 hours by default", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));

    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    await postTreatments([
      {
        eventType: "Correction Bolus",
        created_at: "2026-06-10T13:00:00.000Z",
        insulin: 1.5
      },
      {
        eventType: "Correction Bolus",
        created_at: "2026-06-10T11:00:00.000Z",
        insulin: 1.1
      }
    ], secretHeader(secret));

    const treatmentsResponse = await SELF.fetch(
      "https://example.com/api/v1/treatments.json",
      { headers: secretHeader(secret) }
    );
    expect(treatmentsResponse.status).toBe(200);

    const treatments = (await treatmentsResponse.json()) as Array<{ created_at: string }>;
    expect(treatments).toHaveLength(1);
    expect(treatments[0].created_at).toBe("2026-06-10T13:00:00.000Z");
  });

  it("supports idempotent treatment deletes for tconnectsync", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const treatmentId = "1781556330000:Sleep:Pump (tconnectsync):Sleep (Scheduled) - Not Ended";

    await postTreatments({
      _id: treatmentId,
      eventType: "Sleep",
      created_at: "2026-06-15T20:45:30.000Z",
      enteredBy: "Pump (tconnectsync)",
      notes: "Sleep (Scheduled) - Not Ended"
    }, secretHeader(secret));

    const firstDelete = await deleteTreatment(treatmentId, secretHeader(secret));
    expect(firstDelete.status).toBe(200);
    expect(await firstDelete.json()).toEqual({
      status: "ok",
      deleted: true,
      _id: treatmentId
    });

    const secondDelete = await deleteTreatment(treatmentId, secretHeader(secret));
    expect(secondDelete.status).toBe(200);
    expect(await secondDelete.json()).toEqual({
      status: "ok",
      deleted: false,
      _id: treatmentId
    });
  });

  it("returns status and compatibility endpoints", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const statusResponse = await SELF.fetch("https://example.com/api/v1/status.json", {
      headers: secretHeader(secret)
    });
    expect(statusResponse.status).toBe(200);
    const status = (await statusResponse.json()) as { status: string; entries: { count: number } };
    expect(status.status).toBe("ok");
    expect(typeof status.entries.count).toBe("number");

    const treatmentsResponse = await SELF.fetch("https://example.com/api/v1/treatments", {
      headers: secretHeader(secret)
    });
    expect(await treatmentsResponse.json()).toEqual([]);
  });

  it("shows the delta between the latest reading and the previous one on health", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    await postEntries([
      { sgv: 145, date: 1781111113200, direction: "Flat", type: "sgv" },
      { sgv: 138, date: 1781111113100, direction: "Flat", type: "sgv" }
    ], secretHeader(secret));

    const response = await SELF.fetch("https://example.com/health", {
      headers: secretHeader(secret)
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('class="reading-delta is-up">+7<');
  });

  it("supports Nightscout profile current and profile writes for tconnectsync", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    const emptyCurrentResponse = await SELF.fetch("https://example.com/api/v1/profile/current", {
      headers: secretHeader(secret)
    });
    expect(emptyCurrentResponse.status).toBe(200);
    expect(await emptyCurrentResponse.json()).toEqual({});

    const profilePayload = {
      defaultProfile: "Verano",
      enteredBy: "Pump (tconnectsync)",
      startDate: "2026-06-15T08:00:00.000Z",
      created_at: "2026-06-15T08:00:00.000Z",
      store: {
        Verano: {
          dia: "5",
          basal: [{ time: "00:00", timeAsSeconds: 0, value: 0.18 }],
          sens: [{ time: "00:00", timeAsSeconds: 0, value: 180 }],
          carbratio: [{ time: "00:00", timeAsSeconds: 0, value: 25 }],
          target_low: [{ time: "00:00", timeAsSeconds: 0, value: 120 }],
          target_high: [{ time: "00:00", timeAsSeconds: 0, value: 120 }],
          units: "mg/dl",
          timezone: "Europe/Madrid"
        }
      }
    };

    const postResponse = await postProfile(profilePayload, secretHeader(secret));
    expect(postResponse.status).toBe(200);

    const currentResponse = await SELF.fetch("https://example.com/api/v1/profile/current?api_secret=test", {
      headers: secretHeader(await sha1(secret))
    });
    expect(currentResponse.status).toBe(200);
    const currentProfile = await currentResponse.json();
    expect(currentProfile).toMatchObject({
      defaultProfile: "Verano",
      enteredBy: "Pump (tconnectsync)"
    });

    const listResponse = await SELF.fetch("https://example.com/api/v1/profile.json", {
      headers: secretHeader(secret)
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([profilePayload]);
  });

  it("returns a helpful payload for the api base path", async () => {
    const response = await SELF.fetch("https://example.com/api/v1");
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      status: string;
      endpoints: { status: string; entries: string };
      message: string;
    };

    expect(payload.status).toBe("ok");
    expect(payload.message).toContain("Nightscout-compatible API base");
    expect(payload.endpoints.status).toBe("/api/v1/status.json");
    expect(payload.endpoints.entries).toBe("/api/v1/entries.json");
  });

  it("renders the health page", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);
    env.HEALTH_REFRESH_SECONDS = "45";

    await postEntries({ sgv: 143, date: 1781111111111 }, secretHeader(secret));
    await postTreatments(
      {
        eventType: "Correction Bolus",
        created_at: "2026-06-10T20:05:00.000Z",
        insulin: 1.2,
        notes: "Test bolus"
      },
      secretHeader(secret)
    );

    const response = await SELF.fetch("https://example.com/health", {
      headers: secretHeader(secret)
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("GlucoEasy");
    expect(html).toContain("Latest treatment");
    expect(html).toContain("Correction Bolus");
    expect(html).toContain('class="reading treatment-reading">1.2 <span>U</span>');
    expect(html).toContain("Received:");
    expect(html).toContain("View status data");
    expect(html).toContain("window.setTimeout(() =>");
    expect(html).toContain("window.location.reload()");
    expect(html).toContain("45000");
  });

  it("renders the latest treatment with insulin on the health page", async () => {
    const { secret, cookie } = await initializeSetup();
    await acknowledgeSetup(cookie);

    await postTreatments(
      [
        {
          eventType: "Site Change",
          created_at: "2026-06-10T20:10:00.000Z",
          notes: "No insulin here"
        },
        {
          eventType: "Correction Bolus",
          created_at: "2026-06-10T20:05:00.000Z",
          insulin: 1.2,
          notes: "Last insulin treatment"
        },
        {
          eventType: "Carb Correction",
          created_at: "2026-06-10T20:00:00.000Z",
          carbs: 12
        }
      ],
      secretHeader(secret)
    );

    const response = await SELF.fetch("https://example.com/health", {
      headers: secretHeader(secret)
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Latest treatment");
    expect(html).toContain("Correction Bolus");
    expect(html).toContain('class="reading treatment-reading">1.2 <span>U</span>');
    expect(html).toContain("Received:");
    expect(html).not.toContain("Site Change");
  });

  it("renders the spanish health page", async () => {
    const setupResponse = await SELF.fetch("https://example.com/es/health");
    expect(setupResponse.status).toBe(200);
    const setupCookie = setupResponse.headers.get("Set-Cookie");
    expect(setupCookie).toContain("tinyscout_setup=");
    const setupHtml = await setupResponse.text();
    expect(setupHtml).toContain('<html lang="es">');
    expect(setupHtml).toContain("Configuracion completada");
    expect(setupHtml).toContain('action="/es/setup/acknowledge"');
    const secretMatch = setupHtml.match(/<code>([a-z2-9]{6})<\/code>/);
    expect(secretMatch?.[1]).toBeTruthy();
    const secret = secretMatch![1];

    const acknowledgeResponse = await SELF.fetch("https://example.com/es/setup/acknowledge", {
      method: "POST",
      headers: { Cookie: setupCookie!.split(";", 1)[0] },
      redirect: "manual"
    });
    expect(acknowledgeResponse.status).toBe(303);
    expect(acknowledgeResponse.headers.get("Location")).toBe("https://example.com/es/health");

    await postEntries({ sgv: 143, date: 1781111111111 }, secretHeader(secret));
    await postTreatments(
      {
        eventType: "Correction Bolus",
        created_at: "2026-06-10T20:05:00.000Z",
        insulin: 1.2,
        notes: "Test bolus"
      },
      secretHeader(secret)
    );

    const response = await SELF.fetch("https://example.com/es/health", {
      headers: secretHeader(secret)
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("GlucoEasy");
    expect(html).toContain("Ultimo tratamiento");
    expect(html).toContain("Ver datos de estado");
    expect(html).toContain('class="reading treatment-reading">1.2 <span>U</span>');
    expect(html).toContain("Recibido hace:");
  });
});
