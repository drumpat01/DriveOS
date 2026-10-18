// Route map for journeydeck-site. route-list.csv is the only source.
// Paige owns the list. Regenerate it with gen-route-list.mjs; do not hand-edit rows.

export const routeActions = ["asset", "asset_typed", "redirect", "not_found_page", "status_only", "native", "proxy", "none"] as const;
export type RouteAction = typeof routeActions[number];

export const matchKinds = ["exact", "pattern", "prefix", "fallback", "query"] as const;
export type MatchKind = typeof matchKinds[number];

export interface RouteRow {
  route_id: string;
  method: string;
  path: string;
  match: MatchKind;
  type: string;
  phase1_owner: string;
  worker_action: RouteAction;
  target: string;
  expected_status: string;
  content_type: string;
  cache_control: string;
  x_robots_tag: string;
  canonical: string;
  other_headers: string;
  auth: string;
  worker_secrets: string;
  handler_file: string;
  probe_method: string;
  probe_path: string;
  probe_body: string;
  probe_compare: string;
  live_status: string;
  live_content_type: string;
  live_cache_control: string;
  live_x_robots_tag: string;
  live_location: string;
  notes: string;
  pattern?: RegExp;
}

const columns = [
  "route_id", "method", "path", "match", "type", "phase1_owner", "worker_action", "target", "expected_status", "content_type", "cache_control", "x_robots_tag", "canonical", "other_headers", "auth", "worker_secrets", "handler_file", "probe_method", "probe_path", "probe_body", "probe_compare", "live_status", "live_content_type", "live_cache_control", "live_x_robots_tag", "live_location", "notes"
] as const;

function isRouteAction(value: string): value is RouteAction {
  return routeActions.some(action => action === value);
}

function isMatchKind(value: string): value is MatchKind {
  return matchKinds.some(kind => kind === value);
}

export function parseCsv(text: string) {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"") {
        if (text[index + 1] === "\"") { cell += "\""; index += 1; }
        else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

function patternToRegExp(pattern: string) {
  const body = pattern.split("/").map(segment => segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/");
  return new RegExp(`^${body}$`);
}

export function parseRouteList(csv: string): RouteRow[] {
  const [header, ...records] = parseCsv(csv).filter(row => row.some(cell => cell.length > 0));
  if (!header) throw new Error("route-list.csv is empty.");
  const missing = columns.filter(column => !header.includes(column));
  if (missing.length) throw new Error(`route-list.csv is missing ${missing.join(", ")}.`);
  return records.map(record => {
    const raw = Object.fromEntries(header.map((name, index) => [name, record[index] ?? ""])) as Record<string, string>;
    if (!isMatchKind(raw.match)) throw new Error(`${raw.route_id} has unknown match ${raw.match}.`);
    if (!isRouteAction(raw.worker_action)) throw new Error(`${raw.route_id} has unknown action ${raw.worker_action}.`);
    const row: RouteRow = {
      route_id: raw.route_id,
      method: raw.method,
      path: raw.path,
      match: raw.match,
      type: raw.type,
      phase1_owner: raw.phase1_owner,
      worker_action: raw.worker_action,
      target: raw.target,
      expected_status: raw.expected_status,
      content_type: raw.content_type,
      cache_control: raw.cache_control,
      x_robots_tag: raw.x_robots_tag,
      canonical: raw.canonical,
      other_headers: raw.other_headers,
      auth: raw.auth,
      worker_secrets: raw.worker_secrets,
      handler_file: raw.handler_file,
      probe_method: raw.probe_method,
      probe_path: raw.probe_path,
      probe_body: raw.probe_body,
      probe_compare: raw.probe_compare,
      live_status: raw.live_status,
      live_content_type: raw.live_content_type,
      live_cache_control: raw.live_cache_control,
      live_x_robots_tag: raw.live_x_robots_tag,
      live_location: raw.live_location,
      notes: raw.notes
    };
    if (row.match === "pattern") row.pattern = patternToRegExp(row.path);
    return row;
  });
}

function methodMatches(route: RouteRow, method: string) {
  if (route.method === "ALL") return true;
  if (route.method === method) return true;
  return route.method === "GET" && method === "HEAD";
}

function pathMatches(route: RouteRow, pathname: string, search: string) {
  switch (route.match) {
    case "exact":
      return pathname === route.path;
    case "query": {
      const [path] = route.path.split("?");
      return pathname === path && new URLSearchParams(search).has("v");
    }
    case "pattern":
      return route.pattern?.test(pathname) ?? false;
    case "prefix": {
      const base = route.path.replace(/\/\*$/, "");
      return pathname === base || pathname.startsWith(`${base}/`);
    }
    case "fallback":
      return true;
    default: {
      const exhaustive: never = route.match;
      return exhaustive;
    }
  }
}

function rank(route: RouteRow) {
  const methodBias = route.method === "ALL" ? 0 : 50;
  switch (route.match) {
    case "query":
      return 500 + methodBias;
    case "exact":
      return 400 + methodBias;
    case "pattern":
      return 300 + route.path.length + methodBias;
    case "prefix":
      return 200 + route.path.length + methodBias;
    case "fallback":
      return methodBias;
    default: {
      const exhaustive: never = route.match;
      return exhaustive;
    }
  }
}

export function matchRoute(routes: readonly RouteRow[], method: string, pathname: string, search: string) {
  const verb = method.toUpperCase();
  let winner: RouteRow | undefined;
  let winnerRank = -1;
  for (const route of routes) {
    if (route.worker_action === "none") continue;
    if (!methodMatches(route, verb) || !pathMatches(route, pathname, search)) continue;
    const score = rank(route);
    if (score > winnerRank) {
      winner = route;
      winnerRank = score;
    }
  }
  return winner;
}

export function probePathFor(route: RouteRow) {
  if (route.match === "query") return route.path;
  if (route.match === "pattern") return route.path.replace(/:[A-Za-z]+/g, "parity");
  if (route.match === "prefix") return `${route.path.replace(/\/\*$/, "")}/parity-probe`;
  if (route.match === "fallback") return "/parity-check-not-a-page";
  return route.path;
}
