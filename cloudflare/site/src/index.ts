import routeListCsv from "../route-list.csv";
import type { SiteEnv } from "./env.ts";
import { HOMEPAGE_LINKS, jsonResponse, mimeForPath, versionedCache, VERSIONED_IMMUTABLE, withOwnedHeaders } from "./headers.ts";
import { proxyToRender } from "./proxy.ts";
import { appleRootDer, assertPinnedCertificateDigests, handleRetention, retentionSettingsFromEnv } from "./retention.ts";
import { matchRoute, parseRouteList, type RouteRow } from "./routes.ts";

const routes = parseRouteList(routeListCsv);
// Fingerprints only. Certificate DER parsing already ran when retention.ts loaded.
// importKey stays on the first request and is memoized per isolate.
await assertPinnedCertificateDigests();

function contentTypeFor(route: RouteRow) {
  if (route.content_type) return route.content_type;
  return mimeForPath(route.target || route.path);
}

function cacheControlFor(route: RouteRow, url: URL) {
  if ((route.worker_action === "asset" || route.worker_action === "asset_typed") && versionedCache(url)) return VERSIONED_IMMUTABLE;
  return route.cache_control;
}

function applyRouteHeaders(request: Request, response: Response, route: RouteRow) {
  const url = new URL(request.url);
  return withOwnedHeaders(response, headers => {
    const contentType = contentTypeFor(route);
    if (contentType) headers.set("content-type", contentType);
    const cache = cacheControlFor(route, url);
    if (cache) headers.set("cache-control", cache);
    if (route.x_robots_tag) headers.set("x-robots-tag", route.x_robots_tag);
    if (route.path === "/" && route.worker_action === "asset") headers.set("link", HOMEPAGE_LINKS);
    const allow = response.headers.get("allow");
    if (allow) headers.set("allow", allow);
  });
}

function assetRequest(request: Request, pathname: string) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  const headers = new Headers();
  const validator = request.headers.get("if-none-match");
  if (validator) headers.set("if-none-match", validator);
  return new Request(url, { method: "GET", headers });
}

function assetBody(request: Request, asset: Response, status: number) {
  if (request.method === "HEAD" || status === 304) return null;
  return asset.body;
}

async function fetchAsset(request: Request, env: SiteEnv, route: RouteRow) {
  const asset = await env.ASSETS.fetch(assetRequest(request, `/${route.target.replace(/^\/+/, "")}`));
  if (asset.status === 404) return asset;
  return new Response(assetBody(request, asset, asset.status), { status: asset.status, headers: asset.headers });
}

async function fetchNotFound(request: Request, env: SiteEnv) {
  const asset = await env.ASSETS.fetch(assetRequest(request, "/404.html"));
  const status = asset.status === 304 ? 304 : 404;
  return new Response(assetBody(request, asset, status), { status, headers: asset.headers });
}

function redirect(route: RouteRow) {
  return new Response(null, { status: 301, headers: { location: route.target } });
}

function statusOnly(route: RouteRow) {
  if (route.target !== "403") return jsonResponse(500, { error: "The request could not be handled." });
  return jsonResponse(403, { statusCode: 403, error: "Forbidden", message: "Forbidden" });
}

export default {
  async fetch(request: Request, env: SiteEnv): Promise<Response> {
    const url = new URL(request.url);
    const route = matchRoute(routes, request.method, url.pathname, url.search);
    try {
      if (!route) return jsonResponse(404, { error: "Not found." });
      switch (route.worker_action) {
        case "asset":
        case "asset_typed": {
          const asset = await fetchAsset(request, env, route);
          if (asset.status === 404) return applyRouteHeaders(request, await fetchNotFound(request, env), { ...route, worker_action: "not_found_page", content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow" });
          return applyRouteHeaders(request, asset, route);
        }
        case "redirect":
          return applyRouteHeaders(request, redirect(route), route);
        case "not_found_page":
          return applyRouteHeaders(request, await fetchNotFound(request, env), route);
        case "status_only":
          return applyRouteHeaders(request, statusOnly(route), route);
        case "native":
          return applyRouteHeaders(request, await handleRetention(request, await retentionSettingsFromEnv(env, appleRootDer, request.headers.get("host") || url.host)), route);
        case "proxy":
          return proxyToRender(request, env.RENDER_ORIGIN || "https://driveos.onrender.com");
        case "none":
          return jsonResponse(404, { error: "Not found." });
        default: {
          const exhaustive: never = route.worker_action;
          return exhaustive;
        }
      }
    } catch (error) {
      console.error(JSON.stringify({ event: "site_worker_error", message: error instanceof Error ? error.message : "error" }));
      return jsonResponse(500, { error: "The request could not be handled." });
    }
  }
};
