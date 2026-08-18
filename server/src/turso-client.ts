type Statement = { sql: string; args?: unknown[] };
type TursoCell = { type?: string; value?: string; base64?: string } | null;
type TursoResult = { cols?: Array<{ name?: string }>; rows?: TursoCell[][] };

export function tursoHttpUrl(databaseUrl: string) {
  const match = databaseUrl.trim().match(/^libsql:\/\/([A-Za-z0-9.-]+)(?::\d+)?\/?$/);
  if (!match) throw new Error("TURSO_DATABASE_URL must be a valid libsql:// Turso database URL.");
  return `https://${match[1]}`;
}

function timeoutMilliseconds() {
  const seconds = Number(process.env.JOURNEYDECK_TURSO_HTTP_TIMEOUT_SECONDS || 30);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 300) throw new Error("JOURNEYDECK_TURSO_HTTP_TIMEOUT_SECONDS must be between 1 and 300.");
  return seconds * 1000;
}

function argument(value: unknown) {
  return value === null || value === undefined ? { type: "null" } : { type: "text", value: String(value) };
}

export function decodeTursoRows(result: TursoResult): Record<string, unknown>[] {
  const columns = (result.cols || []).map(column => String(column.name || ""));
  return (result.rows || []).map(row => Object.fromEntries(columns.map((column, index) => {
    const cell = row[index];
    if (!cell || cell.type === "null") return [column, null];
    if (cell.value !== undefined) return [column, cell.value];
    if (cell.base64 !== undefined) return [column, cell.base64];
    return [column, null];
  })));
}

export async function queryTurso(statements: Statement[]) {
  const databaseUrl = process.env.TURSO_DATABASE_URL || "";
  const token = process.env.TURSO_AUTH_TOKEN || "";
  if (!databaseUrl || !token) throw new Error("Turso credentials are required to refresh Atlas.");
  const response = await fetch(`${tursoHttpUrl(databaseUrl)}/v2/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ requests: [...statements.map(statement => ({ type: "execute", stmt: { sql: statement.sql, args: (statement.args || []).map(argument) } })), { type: "close" }] }),
    signal: AbortSignal.timeout(timeoutMilliseconds())
  });
  if (!response.ok) throw new Error(`Turso query failed with HTTP ${response.status}.`);
  const payload = await response.json() as { results?: Array<{ type?: string; error?: { message?: string }; response?: { result?: TursoResult } }> };
  return statements.map((_, index) => {
    const result = payload.results?.[index];
    if (!result || result.type !== "ok" || !result.response?.result) throw new Error(`Turso query failed: ${result?.error?.message || "invalid response"}`);
    return decodeTursoRows(result.response.result);
  });
}
