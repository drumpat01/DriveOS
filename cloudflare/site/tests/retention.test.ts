import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { SiteEnv } from "../src/env.ts";
import {
  APPLE_ROOT_CA_G3_SHA256,
  DEFAULT_RETENTION_MESSAGE_ID,
  RETENTION_BODY_LIMIT,
  assertAppleRootPin,
  handleRetention,
  retentionSettingsFromEnv
} from "../src/retention.ts";
import { breakSignature, createTestChain, requestBody, signRealtimeRequest } from "./chain.ts";

const appleRoot = new Uint8Array(readFileSync(join(import.meta.dirname, "..", "..", "..", "server", "certs", "AppleRootCA-G3.cer")));

function settings(rootDer: Buffer, environments = "Production,Sandbox", messageId = DEFAULT_RETENTION_MESSAGE_ID) {
  return retentionSettingsFromEnv({
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    RENDER_ORIGIN: "https://driveos.onrender.com",
    JOURNEYDECK_RETENTION_MESSAGE_ID: messageId,
    JOURNEYDECK_RETENTION_ENVIRONMENTS: environments,
    ALLOW_RETENTION_TEST_ROOT: "true",
    RETENTION_TEST_ROOT_BASE64: rootDer.toString("base64")
  } satisfies SiteEnv, appleRoot);
}

function post(body: BodyInit, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("https://journeydeck.me/retention-messaging-api", { method: "POST", headers, body });
}

test("pinned Apple Root CA - G3 matches the published fingerprint", () => {
  assert.equal(assertAppleRootPin(appleRoot), APPLE_ROOT_CA_G3_SHA256);
  const certificate = new X509Certificate(appleRoot);
  assert.match(certificate.subject, /Apple Root CA - G3/);
  assert.equal(certificate.issuer, certificate.subject);
  assert.throws(() => assertAppleRootPin(new Uint8Array([1, 2, 3])), /fingerprint/);
});

test("retention settings stay on vars and the wrangler config has no test root", () => {
  const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(source.includes("ALLOW_RETENTION_TEST_ROOT"), false);
  assert.equal(source.includes("RETENTION_TEST_ROOT_BASE64"), false);
  assert.equal(source.includes("secret"), false);
  assert.throws(() => retentionSettingsFromEnv({
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    RENDER_ORIGIN: "https://driveos.onrender.com",
    ALLOW_RETENTION_TEST_ROOT: "true"
  }, appleRoot), /test root/);
});

test("Get Retention Message accepts a verified request and rejects invalid ones", async () => {
  const chain = createTestChain();
  const untrusted = createTestChain();
  const lines: string[] = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
  console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
  try {
    const configured = settings(chain.rootDer);
    const productionPayload = signRealtimeRequest(chain, requestBody());
    const started = Date.now();
    const accepted = await handleRetention(post(JSON.stringify({ signedPayload: productionPayload })), configured);
    const acceptedBody = await accepted.text();
    assert.equal(accepted.status, 200, acceptedBody);
    assert.equal(Date.now() - started < 700, true);
    assert.equal(accepted.headers.get("cache-control"), "no-store");
    assert.match(accepted.headers.get("content-type") || "", /application\/json/);
    assert.deepEqual(JSON.parse(acceptedBody), { message: { messageIdentifier: DEFAULT_RETENTION_MESSAGE_ID } });
    assert.equal(acceptedBody.includes("1000000000000001"), false);
    assert.equal(acceptedBody.includes(productionPayload), false);

    const slashed = await handleRetention(
      new Request("https://journeydeck.me/retention-messaging-api/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody({ environment: "Sandbox", bundleId: "com.journeydeck.recorder" })) })
      }),
      configured
    );
    assert.equal(slashed.status, 200, await slashed.text());

    const badSignature = await handleRetention(post(JSON.stringify({ signedPayload: breakSignature(productionPayload) })), configured);
    const badSignatureBody = await badSignature.text();
    assert.equal(badSignature.status, 401, badSignatureBody);
    assert.equal(badSignatureBody.includes(productionPayload), false);

    const untrustedRoot = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(untrusted, requestBody()) })), configured);
    assert.equal(untrustedRoot.status, 401, await untrustedRoot.text());

    const wrongBundle = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody({ bundleId: "com.example.other" })) })), configured);
    assert.equal(wrongBundle.status, 403, await wrongBundle.text());

    const wrongApp = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody({ appAppleId: 1111111111, environment: "Sandbox" })) })), configured);
    assert.equal(wrongApp.status, 403, await wrongApp.text());

    const wrongEnvironment = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody({ environment: "Xcode" })) })), configured);
    assert.equal(wrongEnvironment.status, 403, await wrongEnvironment.text());

    const sandboxOnly = settings(chain.rootDer, "Sandbox", "11111111-2222-4333-8444-555555555555");
    const sandboxDefault = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody({ environment: "Sandbox" })) })), sandboxOnly);
    const sandboxBody = await sandboxDefault.text();
    assert.equal(sandboxDefault.status, 200, sandboxBody);
    assert.deepEqual(JSON.parse(sandboxBody), { message: { messageIdentifier: "11111111-2222-4333-8444-555555555555" } });
    const productionWhenSandboxOnly = await handleRetention(post(JSON.stringify({ signedPayload: productionPayload })), sandboxOnly);
    assert.equal(productionWhenSandboxOnly.status, 403, await productionWhenSandboxOnly.text());

    const malformed = await handleRetention(post("{}"), configured);
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "A signed RealtimeRequestBody is required." });

    const notAJws = await handleRetention(post(JSON.stringify({ signedPayload: "not-a-jws" })), configured);
    assert.equal(notAJws.status, 400);

    const invalidJson = await handleRetention(post("{not json"), configured);
    assert.equal(invalidJson.status, 400);
    assert.equal((await invalidJson.json()).code, "FST_ERR_CTP_INVALID_JSON_BODY");

    const empty = await handleRetention(post(""), configured);
    assert.equal(empty.status, 400);
    assert.equal((await empty.json()).code, "FST_ERR_CTP_EMPTY_JSON_BODY");

    const wrongType = await handleRetention(post("hello", { "content-type": "text/plain" }), configured);
    assert.equal(wrongType.status, 415);

    const tooLarge = await handleRetention(post("x".repeat(RETENTION_BODY_LIMIT + 1)), configured);
    assert.equal(tooLarge.status, 413);
    assert.equal((await tooLarge.json()).code, "FST_ERR_CTP_BODY_TOO_LARGE");

    const wrongMethod = await handleRetention(new Request("https://journeydeck.me/retention-messaging-api"), configured);
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "POST");

    const wrongMethodSlashed = await handleRetention(new Request("https://journeydeck.me/retention-messaging-api/", { method: "PUT" }), configured);
    assert.equal(wrongMethodSlashed.status, 405);

    const logged = lines.join("\n");
    assert.equal(logged.includes("1000000000000001"), false);
    assert.equal(logged.includes(productionPayload), false);
    assert.match(logged, /c03248af-dd76-4e9b-9c1e-4489cd19a768/);
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    chain.cleanup();
    untrusted.cleanup();
  }
});
