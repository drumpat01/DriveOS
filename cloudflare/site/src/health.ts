import { jsonResponse } from "./headers.ts";

export const HEALTH_BODY = {
  ok: true,
  service: "journeydeck-site"
} as const;

export function healthResponse(request: Request) {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return jsonResponse(405, { error: "Method not allowed." }, { allow: "GET, HEAD", "cache-control": "no-store" });
  }
  if (method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
  return jsonResponse(200, HEALTH_BODY, { "cache-control": "no-store" });
}
