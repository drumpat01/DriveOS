import type { VerificationStatus } from "@apple/app-store-server-library";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type { SiteEnv } from "./env.ts";

/**
 * Apple Root CA - G3, pinned from Apple PKI.
 * Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 */
export const APPLE_ROOT_CA_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
export const DEFAULT_RETENTION_MESSAGE_ID = "7f3c1a92-4e58-4b0d-8c6a-1d2e3f4a5b6c";
export const RETENTION_BUNDLE_ID = "com.journeydeck.recorder";
export const RETENTION_APP_APPLE_ID = 6806502526;
export const RETENTION_BODY_LIMIT = 64 * 1024;

const retentionEnvironmentValues = ["Production", "Sandbox"] as const;
export type RetentionEnvironment = typeof retentionEnvironmentValues[number];
const messageIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const compactJwsPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const jsonContentType = /^application\/json(?:\s*;|$)/i;

type AppleLibrary = typeof import("@apple/app-store-server-library");
type SignedDataVerifier = InstanceType<AppleLibrary["SignedDataVerifier"]>;

export interface RetentionSettings {
  bundleId: string;
  appAppleId: number;
  messageId: string;
  environments: readonly RetentionEnvironment[];
  rootCertificates: Uint8Array[];
}

let appleLibraryPromise: Promise<AppleLibrary> | undefined;
const verifierCache = new Map<string, Map<RetentionEnvironment, SignedDataVerifier>>();

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

export function assertAppleRootPin(bytes: Uint8Array) {
  const fingerprint = createHash("sha256").update(bytes).digest("hex");
  if (fingerprint !== APPLE_ROOT_CA_G3_SHA256) throw new Error("Pinned Apple Root CA - G3 fingerprint does not match.");
  return fingerprint;
}

export function retentionSettingsFromEnv(env: SiteEnv, appleRoot: Uint8Array): RetentionSettings {
  assertAppleRootPin(appleRoot);
  const messageId = env.JOURNEYDECK_RETENTION_MESSAGE_ID || DEFAULT_RETENTION_MESSAGE_ID;
  if (!messageIdPattern.test(messageId)) throw new Error("JOURNEYDECK_RETENTION_MESSAGE_ID must be a UUID.");
  const environments = parseRetentionEnvironments(env.JOURNEYDECK_RETENTION_ENVIRONMENTS);
  if (env.ALLOW_RETENTION_TEST_ROOT === "true") {
    if (!env.RETENTION_TEST_ROOT_BASE64) throw new Error("Retention test root was allowed but not provided.");
    return { bundleId: RETENTION_BUNDLE_ID, appAppleId: RETENTION_APP_APPLE_ID, messageId, environments, rootCertificates: [Buffer.from(env.RETENTION_TEST_ROOT_BASE64, "base64")] };
  }
  return { bundleId: RETENTION_BUNDLE_ID, appAppleId: RETENTION_APP_APPLE_ID, messageId, environments, rootCertificates: [appleRoot] };
}

// jsrsasign calls crypto during module init. A top-level import crashes workerd
// ("Disallowed operation called within global scope"), so the library is loaded
// on the request path and cached for the isolate.
function loadAppleLibrary() {
  appleLibraryPromise ??= import("@apple/app-store-server-library");
  return appleLibraryPromise;
}

function appleEnvironment(environment: RetentionEnvironment, library: AppleLibrary) {
  switch (environment) {
    case "Production":
      return library.Environment.PRODUCTION;
    case "Sandbox":
      return library.Environment.SANDBOX;
    default: {
      const exhaustive: never = environment;
      return exhaustive;
    }
  }
}

function rejectionFor(status: VerificationStatus, library: AppleLibrary) {
  switch (status) {
    case library.VerificationStatus.INVALID_APP_IDENTIFIER:
      return { statusCode: 403 as const, reason: "app_mismatch" };
    case library.VerificationStatus.INVALID_ENVIRONMENT:
      return { statusCode: 403 as const, reason: "environment_mismatch" };
    case library.VerificationStatus.INVALID_CHAIN_LENGTH:
      return { statusCode: 401 as const, reason: "invalid_chain" };
    case library.VerificationStatus.INVALID_CERTIFICATE:
      return { statusCode: 401 as const, reason: "invalid_certificate" };
    case library.VerificationStatus.OK:
    case library.VerificationStatus.VERIFICATION_FAILURE:
    case library.VerificationStatus.RETRYABLE_VERIFICATION_FAILURE:
    case library.VerificationStatus.FAILURE:
      return { statusCode: 401 as const, reason: "invalid_signature" };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function claimedEnvironment(signedPayload: string) {
  try {
    const encoded = signedPayload.split(".")[1];
    if (!encoded) return undefined;
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { environment?: unknown };
    return typeof parsed.environment === "string" ? parsed.environment : undefined;
  } catch {
    return undefined;
  }
}

async function verifiersFor(settings: RetentionSettings) {
  const library = await loadAppleLibrary();
  const fingerprint = createHash("sha256").update(Buffer.concat(settings.rootCertificates.map(bytes => Buffer.from(bytes)))).digest("hex");
  const key = `${fingerprint}:${settings.environments.join(",")}:${settings.bundleId}:${settings.appAppleId}`;
  const cached = verifierCache.get(key);
  if (cached) return { library, verifiers: cached };
  if (settings.environments.length === 0) throw new Error("At least one retention messaging environment is required.");
  const verifiers = new Map<RetentionEnvironment, SignedDataVerifier>();
  const roots = settings.rootCertificates.map(bytes => Buffer.from(bytes));
  for (const environment of settings.environments) {
    verifiers.set(environment, new library.SignedDataVerifier(roots, false, appleEnvironment(environment, library), settings.bundleId, settings.appAppleId));
  }
  verifierCache.set(key, verifiers);
  return { library, verifiers };
}

function jsonBody(status: number, body: unknown, extra?: Record<string, string>) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  return new Response(JSON.stringify(body), { status, headers });
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
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return { ok: true as const, text: new TextDecoder().decode(merged) };
}

export async function handleRetention(request: Request, settings: RetentionSettings) {
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
  try { parsed = JSON.parse(limited.text); }
  catch {
    return jsonBody(400, { statusCode: 400, code: "FST_ERR_CTP_INVALID_JSON_BODY", error: "Bad Request", message: "Body is not valid JSON but content-type is set to 'application/json'" });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonBody(400, { error: "A signed RealtimeRequestBody is required." });
  const signedPayload = (parsed as { signedPayload?: unknown }).signedPayload;
  if (typeof signedPayload !== "string" || !compactJwsPattern.test(signedPayload)) return jsonBody(400, { error: "A signed RealtimeRequestBody is required." });
  try {
    const { library, verifiers } = await verifiersFor(settings);
    const claimed = claimedEnvironment(signedPayload);
    const selected = claimed && isRetentionEnvironment(claimed) && settings.environments.some(environment => environment === claimed)
      ? verifiers.get(claimed)
      : verifiers.values().next().value;
    if (!selected) throw new library.VerificationException(library.VerificationStatus.INVALID_ENVIRONMENT);
    const decoded = await selected.verifyAndDecodeRealtimeRequest(signedPayload) as { appAppleId?: unknown; bundleId?: unknown; environment?: unknown; requestIdentifier?: unknown; productId?: unknown; userLocale?: unknown };
    if (decoded.appAppleId !== settings.appAppleId) throw new library.VerificationException(library.VerificationStatus.INVALID_APP_IDENTIFIER);
    if (decoded.bundleId !== undefined && decoded.bundleId !== settings.bundleId) throw new library.VerificationException(library.VerificationStatus.INVALID_APP_IDENTIFIER);
    if (typeof decoded.environment !== "string" || !isRetentionEnvironment(decoded.environment) || !settings.environments.some(environment => environment === decoded.environment)) {
      throw new library.VerificationException(library.VerificationStatus.INVALID_ENVIRONMENT);
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
    const library = await loadAppleLibrary();
    if (error instanceof library.VerificationException) {
      const rejection = rejectionFor(error.status, library);
      console.warn(JSON.stringify({ event: "retention_message_rejected", reason: rejection.reason }));
      const message = rejection.statusCode === 403
        ? "The retention message request does not match this app."
        : "The signed payload could not be verified.";
      return jsonBody(rejection.statusCode, { error: message });
    }
    console.warn(JSON.stringify({ event: "retention_message_rejected", reason: "unexpected" }));
    return jsonBody(500, { error: "The retention message request could not be handled." });
  }
}
