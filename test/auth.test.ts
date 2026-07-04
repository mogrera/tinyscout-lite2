import { describe, expect, it } from "vitest";
import { optionsResponse, requireReadAuth, requireWriteAuth } from "../src/auth";
import type { Env } from "../src/types";

const env = {
  API_SECRET: "secret",
  READ_PUBLIC: "false"
} as Env;

describe("auth", () => {
  it("accepts api-secret header", async () => {
    const request = new Request("https://example.com/api/v1/entries", {
      method: "POST",
      headers: { "api-secret": "secret" }
    });
    expect(await requireWriteAuth(request, env)).toBeNull();
  });

  it("accepts SHA1 api-secret header", async () => {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode("secret"));
    const sha1 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const request = new Request("https://example.com/api/v1/entries", {
      method: "POST",
      headers: { "api-secret": sha1 }
    });
    expect(await requireWriteAuth(request, env)).toBeNull();
  });

  it("accepts basic auth header", async () => {
    const request = new Request("https://example.com/api/v1/entries", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa("secret:ignored")}` }
    });
    expect(await requireWriteAuth(request, env)).toBeNull();
  });

  it("rejects protected reads by default", async () => {
    const request = new Request("https://example.com/api/v1/status.json");
    expect((await requireReadAuth(request, env))?.status).toBe(401);
  });

  it("allows public reads when configured", async () => {
    const request = new Request("https://example.com/api/v1/status.json");
    expect(await requireReadAuth(request, { ...env, READ_PUBLIC: "true" } as Env)).toBeNull();
  });

  it("returns CORS headers on options", () => {
    const response = optionsResponse();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
  });
});
