import type { Env } from "./types";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type, api-secret, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400"
} as const;

export function corsHeaders(): HeadersInit {
  return CORS_HEADERS;
}

export function isReadPublic(env: Env): boolean {
  return env.READ_PUBLIC?.toLowerCase() === "true";
}

function decodeBasicSecret(header: string | null): string | null {
  if (!header || !header.toLowerCase().startsWith("basic ")) {
    return null;
  }

  try {
    const encoded = header.slice(6).trim();
    const decoded = atob(encoded);
    const [username] = decoded.split(":", 1);
    return username || null;
  } catch {
    return null;
  }
}

function getSecretFromRequest(request: Request): string | null {
  const directHeader = request.headers.get("api-secret");
  if (directHeader) {
    return directHeader;
  }

  const basicSecret = decodeBasicSecret(request.headers.get("Authorization"));
  if (basicSecret) {
    return basicSecret;
  }

  const url = new URL(request.url);
  if (url.username) {
    return url.username;
  }

  return null;
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hasValidSecret(request: Request, expected: string | null | undefined): Promise<boolean> {
  if (!expected) {
    return false;
  }

  const supplied = getSecretFromRequest(request);
  if (!supplied) {
    return false;
  }

  if (supplied === expected) {
    return true;
  }

  const expectedSha1 = await sha1Hex(expected);
  return supplied.toLowerCase() === expectedSha1;
}

export async function requireConfiguredWriteAuth(
  request: Request,
  expected: string | null | undefined
): Promise<Response | null> {
  if (!expected) {
    return null;
  }

  return (await hasValidSecret(request, expected)) ? null : unauthorized();
}

export function requireWriteAuth(request: Request, env: Env): Promise<Response | null> {
  return requireConfiguredWriteAuth(request, env.API_SECRET);
}

export function requireReadAuth(request: Request, env: Env): Promise<Response | null> {
  if (isReadPublic(env)) {
    return Promise.resolve(null);
  }

  return requireConfiguredWriteAuth(request, env.API_SECRET);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
