const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function jsonResponse(payload: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export async function readBoundedJson(request: Request, maximumBytes = 16_384): Promise<Record<string, unknown> | null> {
  const reportedLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(reportedLength) && reportedLength > maximumBytes) return null;
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > maximumBytes) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function stringField(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function optionalSecret(env: Env, key: string): string | null {
  const value: unknown = (env as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
