import { APPLE_ROOT_CA_G3_BASE64, APPLE_WWDR_G6_BASE64 } from "./apple-pinned-certs.ts";
import type { SiteEnv } from "./env.ts";
import { inspectRetentionJws, pinPreparedCertificate, RetentionVerifyError, verifyInspectedRetentionJws } from "./retention-jws.ts";

/**
 * Apple Root CA - G3, pinned from Apple PKI.
 * Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 */
export const APPLE_ROOT_CA_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
export const APPLE_WWDR_G6_SHA256 = "bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30";

function decodePinned(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export const appleRootDer = decodePinned(APPLE_ROOT_CA_G3_BASE64);
export const appleWwdrG6Der = decodePinned(APPLE_WWDR_G6_BASE64);
// Synchronous X.509 parse at isolate startup. importKey is not called here.
export const preparedAppleRoot = pinPreparedCertificate(appleRootDer);
export const preparedAppleWwdrG6 = pinPreparedCertificate(appleWwdrG6Der);
export const DEFAULT_RETENTION_MESSAGE_ID = "7f3c1a92-4e58-4b0d-8c6a-1d2e3f4a5b6c";
export const RETENTION_BUNDLE_ID = "com.journeydeck.recorder";
export const RETENTION_APP_APPLE_ID = 6806502526;
export const RETENTION_BODY_LIMIT = 64 * 1024;

const retentionEnvironmentValues = ["Production", "Sandbox"] as const;
export type RetentionEnvironment = typeof retentionEnvironmentValues[number];
const messageIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const compactJwsPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const jsonContentType = /^application\/json(?:\s*;|$)/i;
const pinPromises = new WeakMap<Uint8Array, Promise<string>>();
const testRootBytes = new Map<string, Uint8Array>();
const utf8Decoder = new TextDecoder();

export interface RetentionSettings {
  bundleId: string;
  appAppleId: number;
  messageId: string;
  environments: readonly RetentionEnvironment[];
  rootCertificates: Uint8Array[];
}

function isRetentionEnvironment(value: string): value is RetentionEnvironment {
  return retentionEnvironmentValues.some(environment => environment === value);
}

export function parseRetentionEnvironments(raw: string | undefined) {
  const unique: RetentionEnvironment[] = [];
  for (const part of (raw || "Production,Sandbox").split(",")) {
    const value = part.trim();
    if (!value) continue;
    if (!isRetentionEnvironment(value)) throw new Error("JOURNEYDECK_RETENTION_ENVIRONMENTS must list Production, Sandbox, or both.");
    if (!unique.includes(value)) unique.push(value);
  }
  if (unique.length === 0) throw new Error("JOURNEYDECK_RETENTION_ENVIRONMENTS must list Production, Sandbox, or both.");
  return unique;
}

function hex(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += byte.toString(16).padStart(2, "0");
  return text;
}

async function digestPin(bytes: Uint8Array, expected: string) {
  const pinned = new Uint8Array(bytes.byteLength);
  pinned.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pinned.buffer));
  const fingerprint = hex(digest);
  if (fingerprint !== expected) throw new Error("Pinned Apple certificate fingerprint does not match.");
  return fingerprint;
}

function assertCertificatePin(bytes: Uint8Array, expected: string) {
  const cached = pinPromises.get(bytes);
  if (cached) return cached;
  const pending = digestPin(bytes, expected);
  pinPromises.set(bytes, pending);
  pending.catch(() => {
    if (pinPromises.get(bytes) === pending) pinPromises.delete(bytes);
  });
  return pending;
}

export function assertAppleRootPin(bytes: Uint8Array) {
  return assertCertificatePin(bytes, APPLE_ROOT_CA_G3_SHA256);
}

export function assertPinnedCertificateDigests() {
  return Promise.all([
    assertAppleRootPin(appleRootDer),
    assertCertificatePin(appleWwdrG6Der, APPLE_WWDR_G6_SHA256)
  ]);
}

function isLocalRetentionHost(requestHost: string | undefined) {
  if (!requestHost) return false;
  try {
    let hostname = new URL(`http://${requestHost}`).hostname.toLowerCase();
    if (hostname.startsWith("[") && hostname.endsWith("]")) hostname = hostname.slice(1, -1);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function bytesFromBase64(value: string) {
  const cached = testRootBytes.get(value);
  if (cached) return cached;
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (testRootBytes.size > 4) testRootBytes.clear();
  testRootBytes.set(value, bytes);
  return bytes;
}

export async function retentionSettingsFromEnv(env: SiteEnv, appleRoot: Uint8Array, requestHost?: string): Promise<RetentionSettings> {
  await assertAppleRootPin(appleRoot);
  const messageId = env.JOURNEYDECK_RETENTION_MESSAGE_ID || DEFAULT_RETENTION_MESSAGE_ID;
  if (!messageIdPattern.test(messageId)) throw new Error("JOURNEYDECK_RETENTION_MESSAGE_ID must be a UUID.");
  const environments = parseRetentionEnvironments(env.JOURNEYDECK_RETENTION_ENVIRONMENTS);
  // The fixture root is for tests and local wrangler dev. A public host keeps
  // the pinned Apple root even when the env var is set.
  if (env.ALLOW_RETENTION_TEST_ROOT === "true" && isLocalRetentionHost(requestHost)) {
    if (!env.RETENTION_TEST_ROOT_BASE64) throw new Error("Retention test root was allowed but not provided.");
    return { bundleId: RETENTION_BUNDLE_ID, appAppleId: RETENTION_APP_APPLE_ID, messageId, environments, rootCertificates: [bytesFromBase64(env.RETENTION_TEST_ROOT_BASE64)] };
  }
  return { bundleId: RETENTION_BUNDLE_ID, appAppleId: RETENTION_APP_APPLE_ID, messageId, environments, rootCertificates: [appleRoot] };
}

function jsonBody(status: number, body: unknown, extra?: Record<string, string>) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  return new Response(JSON.stringify(body), { status, headers });
}

function timingProbe(request: Request) {
  if (request.headers.get("x-journeydeck-retention-timing") !== "1") return false;
  try {
    return isLocalRetentionHost(new URL(request.url).host);
  } catch {
    return false;
  }
}

function cpuUsage() {
  const candidate = globalThis as { process?: { cpuUsage?: (previous?: NodeJS.CpuUsage) => NodeJS.CpuUsage } };
  if (typeof candidate.process?.cpuUsage !== "function") return undefined;
  try {
    return candidate.process.cpuUsage();
  } catch {
    return undefined;
  }
}

function stampTiming(request: Request, response: Response, wallMs: number, cpuMs: number | undefined) {
  if (!timingProbe(request)) return response;
  const headers = new Headers(response.headers);
  const metrics = [`retention;dur=${wallMs.toFixed(3)}`];
  if (cpuMs !== undefined) metrics.push(`cpu;dur=${cpuMs.toFixed(3)}`);
  headers.set("server-timing", metrics.join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readLimitedBody(request: Request) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > RETENTION_BODY_LIMIT) return { ok: false as const, status: 413 as const };
  if (!request.body) return { ok: true as const, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > RETENTION_BODY_LIMIT) {
      await reader.cancel();
      return { ok: false as const, status: 413 as const };
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true as const, text: utf8Decoder.decode(merged) };
}

function rejectionMessage(error: RetentionVerifyError) {
  return error.statusCode === 403
    ? "The retention message request does not match this app."
    : "The signed payload could not be verified.";
}

async function respond(request: Request, settings: RetentionSettings) {
  if (request.method.toUpperCase() !== "POST") return jsonBody(405, { error: "Method not allowed." }, { allow: "POST" });
  const contentType = request.headers.get("content-type") || "";
  if (!jsonContentType.test(contentType)) return jsonBody(415, { error: "Content-Type must be application/json." });
  const limited = await readLimitedBody(request);
  if (!limited.ok) {
    return jsonBody(413, { statusCode: 413, code: "FST_ERR_CTP_BODY_TOO_LARGE", error: "Payload Too Large", message: "Request body is too large" });
  }
  if (!limited.text.trim()) {
    return jsonBody(400, { statusCode: 400, code: "FST_ERR_CTP_EMPTY_JSON_BODY", error: "Bad Request", message: "Body cannot be empty when content-type is set to 'application/json'" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(limited.text);
  } catch {
    return jsonBody(400, { statusCode: 400, code: "FST_ERR_CTP_INVALID_JSON_BODY", error: "Bad Request", message: "Body is not valid JSON but content-type is set to 'application/json'" });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonBody(400, { error: "A signed RealtimeRequestBody is required." });
  const signedPayload = (parsed as { signedPayload?: unknown }).signedPayload;
  if (typeof signedPayload !== "string" || !compactJwsPattern.test(signedPayload)) return jsonBody(400, { error: "A signed RealtimeRequestBody is required." });
  if (settings.environments.length === 0) throw new Error("At least one retention messaging environment is required.");
  try {
    const inspected = inspectRetentionJws(signedPayload);
    const claimed = inspected.payload.environment;
    const selected = claimed && isRetentionEnvironment(claimed) && settings.environments.some(environment => environment === claimed)
      ? claimed
      : settings.environments[0];
    if (!selected) throw new RetentionVerifyError("environment_mismatch");
    const decoded = await verifyInspectedRetentionJws(inspected, settings.rootCertificates, selected);
    if (decoded.appAppleId !== settings.appAppleId) throw new RetentionVerifyError("app_mismatch");
    if (decoded.bundleId !== undefined && decoded.bundleId !== settings.bundleId) throw new RetentionVerifyError("app_mismatch");
    if (!isRetentionEnvironment(decoded.environment) || !settings.environments.some(environment => environment === decoded.environment)) {
      throw new RetentionVerifyError("environment_mismatch");
    }
    console.info(JSON.stringify({
      event: "retention_message",
      requestIdentifier: decoded.requestIdentifier,
      productId: decoded.productId,
      userLocale: decoded.userLocale,
      environment: decoded.environment
    }));
    return jsonBody(200, { message: { messageIdentifier: settings.messageId } });
  } catch (error) {
    if (error instanceof RetentionVerifyError) {
      console.warn(JSON.stringify({ event: "retention_message_rejected", reason: error.reason }));
      return jsonBody(error.statusCode, { error: rejectionMessage(error) });
    }
    console.warn(JSON.stringify({ event: "retention_message_rejected", reason: "unexpected" }));
    return jsonBody(500, { error: "The retention message request could not be handled." });
  }
}

export async function handleRetention(request: Request, settings: RetentionSettings) {
  const wallStart = performance.now();
  const cpuStart = cpuUsage();
  const response = await respond(request, settings);
  const wallMs = performance.now() - wallStart;
  let cpuMs: number | undefined;
  if (cpuStart && typeof (globalThis as { process?: { cpuUsage?: (previous?: NodeJS.CpuUsage) => NodeJS.CpuUsage } }).process?.cpuUsage === "function") {
    try {
      const delta = (globalThis as { process: { cpuUsage: (previous?: NodeJS.CpuUsage) => NodeJS.CpuUsage } }).process.cpuUsage(cpuStart);
      cpuMs = (delta.user + delta.system) / 1000;
    } catch {
      cpuMs = undefined;
    }
  }
  return stampTiming(request, response, wallMs, cpuMs);
}
