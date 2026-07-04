import { corsHeaders } from "./auth";

export function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {})
    }
  });
}

export function htmlResponse(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      ...(init.headers ?? {})
    }
  });
}
