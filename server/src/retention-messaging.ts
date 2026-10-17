import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type DecodedRealtimeRequestBody,
  type RealtimeResponseBody
} from "@apple/app-store-server-library";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RetentionEnvironment } from "./config.js";

/**
 * Apple Root CA - G3, pinned from Apple PKI.
 * Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 * Not after: Apr 30 18:19:06 2039 GMT
 */
export const APPLE_ROOT_CA_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
export const APPLE_ROOT_CA_G3_SOURCE = "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer";

const retentionPaths = new Set(["/retention-messaging-api", "/retention-messaging-api/"]);
const compactJwsPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const retentionBodyLimit = 64 * 1024;

export type RetentionMessagingSettings = {
  retentionBundleId: string;
  retentionAppAppleId: number;
  retentionMessageId: string;
  retentionEnvironments: readonly RetentionEnvironment[];
};

type VerifiedRetentionRequest = DecodedRealtimeRequestBody & { bundleId?: unknown };

export function isRetentionMessagingPath(pathname: string) {
  return retentionPaths.has(pathname);
}

export function loadPinnedAppleRootCertificates(repoRoot: string) {
  const certPath = join(repoRoot, "server", "certs", "AppleRootCA-G3.cer");
  const der = readFileSync(certPath);
  const fingerprint = createHash("sha256").update(der).digest("hex");
  if (fingerprint !== APPLE_ROOT_CA_G3_SHA256) throw new Error("Pinned Apple Root CA - G3 fingerprint does not match.");
  return [der];
}

function appleEnvironment(environment: RetentionEnvironment) {
  switch (environment) {
    case "Production":
      return Environment.PRODUCTION;
    case "Sandbox":
      return Environment.SANDBOX;
    default: {
      const exhaustive: never = environment;
      return exhaustive;
    }
  }
}

function rejectionFor(status: VerificationStatus) {
  switch (status) {
    case VerificationStatus.INVALID_APP_IDENTIFIER:
      return { statusCode: 403 as const, reason: "app_mismatch" };
    case VerificationStatus.INVALID_ENVIRONMENT:
      return { statusCode: 403 as const, reason: "environment_mismatch" };
    case VerificationStatus.INVALID_CHAIN_LENGTH:
      return { statusCode: 401 as const, reason: "invalid_chain" };
    case VerificationStatus.INVALID_CERTIFICATE:
      return { statusCode: 401 as const, reason: "invalid_certificate" };
    case VerificationStatus.OK:
    case VerificationStatus.VERIFICATION_FAILURE:
    case VerificationStatus.RETRYABLE_VERIFICATION_FAILURE:
    case VerificationStatus.FAILURE:
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

function isAllowedEnvironment(value: string, allowed: readonly RetentionEnvironment[]): value is RetentionEnvironment {
  return allowed.some(environment => environment === value);
}

export function createRetentionVerifiers(settings: RetentionMessagingSettings, rootCertificates: Buffer[]) {
  if (settings.retentionEnvironments.length === 0) throw new Error("At least one retention messaging environment is required.");
  const verifiers = new Map<RetentionEnvironment, SignedDataVerifier>();
  for (const environment of settings.retentionEnvironments) {
    // Online revocation checks are off so verification stays inside Apple's 700ms
    // production timeout. SignedDataVerifier still checks certificate dates
    // against signedDate, the ES256 signature, and the receipt-signing and
    // Worldwide Developer Relations extension OIDs.
    verifiers.set(environment, new SignedDataVerifier(
      rootCertificates,
      false,
      appleEnvironment(environment),
      settings.retentionBundleId,
      settings.retentionAppAppleId
    ));
  }
  return verifiers;
}

export async function verifyRetentionRequest(signedPayload: string, settings: RetentionMessagingSettings, verifiers: Map<RetentionEnvironment, SignedDataVerifier>) {
  const claimed = claimedEnvironment(signedPayload);
  const selected = claimed && isAllowedEnvironment(claimed, settings.retentionEnvironments)
    ? verifiers.get(claimed)
    : verifiers.values().next().value;
  if (!selected) throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT);
  const decoded = await selected.verifyAndDecodeRealtimeRequest(signedPayload) as VerifiedRetentionRequest;
  // Apple's DecodedRealtimeRequestBody always includes appAppleId and does not
  // include bundleId. Enforce the app id on every environment. Enforce bundleId
  // when the signed claim is present.
  if (decoded.appAppleId !== settings.retentionAppAppleId) throw new VerificationException(VerificationStatus.INVALID_APP_IDENTIFIER);
  if (decoded.bundleId !== undefined && decoded.bundleId !== settings.retentionBundleId) throw new VerificationException(VerificationStatus.INVALID_APP_IDENTIFIER);
  if (!isAllowedEnvironment(decoded.environment, settings.retentionEnvironments)) throw new VerificationException(VerificationStatus.INVALID_ENVIRONMENT);
  return decoded;
}

function retentionResponse(messageIdentifier: string): RealtimeResponseBody {
  return { message: { messageIdentifier } };
}

function reject(reply: FastifyReply, statusCode: number, error: string) {
  return reply.code(statusCode).send({ error });
}

export function registerRetentionMessagingRoutes(app: FastifyInstance, settings: RetentionMessagingSettings, rootCertificates: Buffer[]) {
  const verifiers = createRetentionVerifiers(settings, rootCertificates);
  const handler = async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== "POST") {
      reply.header("allow", "POST");
      return reject(reply, 405, "Method not allowed.");
    }
    const contentType = String(req.headers["content-type"] || "");
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return reject(reply, 415, "Content-Type must be application/json.");
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return reject(reply, 400, "A signed RealtimeRequestBody is required.");
    const signedPayload = (body as { signedPayload?: unknown }).signedPayload;
    if (typeof signedPayload !== "string" || !compactJwsPattern.test(signedPayload)) return reject(reply, 400, "A signed RealtimeRequestBody is required.");
    try {
      const decoded = await verifyRetentionRequest(signedPayload, settings, verifiers);
      req.log.info({
        event: "retention_message",
        requestIdentifier: decoded.requestIdentifier,
        productId: decoded.productId,
        userLocale: decoded.userLocale,
        environment: decoded.environment
      }, "Selected retention message");
      return reply.code(200).send(retentionResponse(settings.retentionMessageId));
    } catch (error) {
      if (error instanceof VerificationException) {
        const rejection = rejectionFor(error.status);
        req.log.warn({ event: "retention_message_rejected", reason: rejection.reason }, "Rejected retention messaging request");
        const message = rejection.statusCode === 403
          ? "The retention message request does not match this app."
          : "The signed payload could not be verified.";
        return reject(reply, rejection.statusCode, message);
      }
      req.log.warn({ event: "retention_message_rejected", reason: "unexpected" }, "Rejected retention messaging request");
      return reject(reply, 500, "The retention message request could not be handled.");
    }
  };
  for (const path of retentionPaths) app.all(path, { bodyLimit: retentionBodyLimit }, handler);
}
