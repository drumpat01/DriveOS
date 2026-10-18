import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { SiteEnv } from "../src/env.ts";
import {
  APPLE_ROOT_CA_G3_SHA256,
  APPLE_WWDR_G6_SHA256,
  DEFAULT_RETENTION_MESSAGE_ID,
  RETENTION_BODY_LIMIT,
  appleRootDer,
  appleWwdrG6Der,
  assertAppleRootPin,
  assertPinnedCertificateDigests,
  handleRetention,
  preparedAppleRoot,
  preparedAppleWwdrG6,
  retentionSettingsFromEnv
} from "../src/retention.ts";
import { certificateSignedBy, loadCertificate } from "../src/retention-jws.ts";
import { breakSignature, createTestChain, requestBody, signRealtimeRequest } from "./chain.ts";

const appleRoot = new Uint8Array(readFileSync(join(import.meta.dirname, "..", "..", "..", "server", "certs", "AppleRootCA-G3.cer")));
const appleWwdrFile = new Uint8Array(readFileSync(join(import.meta.dirname, "..", "..", "..", "server", "certs", "AppleWWDRCAG6.cer")));

function settings(rootDer: Buffer, environments = "Production,Sandbox", messageId = DEFAULT_RETENTION_MESSAGE_ID) {
  return retentionSettingsFromEnv({
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    RENDER_ORIGIN: "https://driveos.onrender.com",
    JOURNEYDECK_RETENTION_MESSAGE_ID: messageId,
    JOURNEYDECK_RETENTION_ENVIRONMENTS: environments,
    ALLOW_RETENTION_TEST_ROOT: "true",
    RETENTION_TEST_ROOT_BASE64: rootDer.toString("base64")
  } satisfies SiteEnv, appleRoot, "127.0.0.1");
}

function post(body: BodyInit, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("https://journeydeck.me/retention-messaging-api", { method: "POST", headers, body });
}

test("pinned Apple Root CA - G3 matches the published fingerprint", async () => {
  assert.equal(Buffer.from(appleRootDer).equals(Buffer.from(appleRoot)), true);
  assert.equal(Buffer.from(appleWwdrG6Der).equals(Buffer.from(appleWwdrFile)), true);
  assert.equal(await assertAppleRootPin(appleRoot), APPLE_ROOT_CA_G3_SHA256);
  const certificate = new X509Certificate(appleRoot);
  assert.match(certificate.subject, /Apple Root CA - G3/);
  assert.equal(certificate.issuer, certificate.subject);
  const parsed = await loadCertificate(appleRoot);
  assert.equal(parsed.subject, certificate.subject);
  assert.equal(parsed.issuer, certificate.issuer);
  assert.equal(parsed.curve, "P-384");
  assert.equal(parsed.signatureHash, "SHA-384");
  assert.equal(parsed.isCa, true);
  assert.equal(await certificateSignedBy(parsed, parsed), true);
  assert.equal(preparedAppleRoot.subject, certificate.subject);
  assert.equal(preparedAppleRoot.curve, "P-384");
  const wwdr = new X509Certificate(appleWwdrG6Der);
  assert.equal(preparedAppleWwdrG6.subject, wwdr.subject);
  assert.equal(preparedAppleWwdrG6.issuer, wwdr.issuer);
  assert.equal(preparedAppleWwdrG6.issuer, preparedAppleRoot.subject);
  assert.equal(preparedAppleWwdrG6.curve, "P-384");
  assert.equal(preparedAppleWwdrG6.isCa, true);
  assert.equal(preparedAppleWwdrG6.hasWwdrOid, true);
  assert.equal(await certificateSignedBy(preparedAppleWwdrG6, preparedAppleRoot), true);
  assert.deepEqual(await assertPinnedCertificateDigests(), [APPLE_ROOT_CA_G3_SHA256, APPLE_WWDR_G6_SHA256]);
  await assert.rejects(() => assertAppleRootPin(new Uint8Array([1, 2, 3])), /fingerprint/);
});

test("retention settings stay on vars and the wrangler config has no test root", async () => {
  const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(source.includes("ALLOW_RETENTION_TEST_ROOT"), false);
  assert.equal(source.includes("RETENTION_TEST_ROOT_BASE64"), false);
  assert.equal(source.includes("secret"), false);
  await assert.rejects(() => retentionSettingsFromEnv({
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    RENDER_ORIGIN: "https://driveos.onrender.com",
    ALLOW_RETENTION_TEST_ROOT: "true"
  }, appleRoot, "127.0.0.1"), /test root/);
});

test("retention test root is honored only on local hosts", async () => {
  const root = Buffer.from("local-retention-test-root");
  const env = {
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    RENDER_ORIGIN: "https://driveos.onrender.com",
    ALLOW_RETENTION_TEST_ROOT: "true",
    RETENTION_TEST_ROOT_BASE64: root.toString("base64")
  } satisfies SiteEnv;
  for (const host of ["127.0.0.1", "127.0.0.1:8787", "localhost", "localhost:8787", "[::1]", "[::1]:8787"]) {
    const configured = await retentionSettingsFromEnv(env, appleRoot, host);
    assert.equal(Buffer.from(configured.rootCertificates[0]).equals(root), true, host);
  }
  for (const host of ["journeydeck.me", "www.journeydeck.me", "journeydeck-site.example.workers.dev", undefined]) {
    const configured = await retentionSettingsFromEnv(env, appleRoot, host);
    assert.equal(Buffer.from(configured.rootCertificates[0]).equals(Buffer.from(appleRoot)), true, String(host));
  }
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
    const configured = await settings(chain.rootDer);
    const productionPayload = signRealtimeRequest(chain, requestBody());
    const started = Date.now();
    const accepted = await handleRetention(new Request("http://127.0.0.1/retention-messaging-api", {
      method: "POST",
      headers: { "content-type": "application/json", "x-journeydeck-retention-timing": "1" },
      body: JSON.stringify({ signedPayload: productionPayload })
    }), configured);
    const acceptedBody = await accepted.text();
    assert.equal(accepted.status, 200, acceptedBody);
    assert.equal(Date.now() - started < 700, true);
    const coldTiming = accepted.headers.get("server-timing") || "";
    const coldMs = Number(/retention;dur=([0-9.]+)/.exec(coldTiming)?.[1]);
    const coldCpu = Number(/cpu;dur=([0-9.]+)/.exec(coldTiming)?.[1]);
    assert.equal(Number.isFinite(coldMs), true);
    // This sample shares the test process, so it is not a fresh isolate.
    // Fresh-isolate median and max are measured outside this single call.
    assert.equal(coldMs < 700, true, `cold handler wall ${coldMs} ms`);
    if (Number.isFinite(coldCpu)) assert.equal(coldCpu < 10, true, `cold handler cpu ${coldCpu} ms`);
    console.log(`retention cold handler wall ${coldMs.toFixed(3)} ms${Number.isFinite(coldCpu) ? ` cpu ${coldCpu.toFixed(3)} ms` : ""}`);
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

    const sandboxOnly = await settings(chain.rootDer, "Sandbox", "11111111-2222-4333-8444-555555555555");
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

    const header = Buffer.from(JSON.stringify({ alg: "none", x5c: chain.x5c })).toString("base64url");
    const body = Buffer.from(JSON.stringify(requestBody())).toString("base64url");
    const unsigned = await handleRetention(post(JSON.stringify({ signedPayload: `${header}.${body}.e30` })), configured);
    assert.equal(unsigned.status, 401, await unsigned.text());

    const shortChain = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody(), chain.x5c.slice(0, 2)) })), configured);
    assert.equal(shortChain.status, 401, await shortChain.text());

    const stale = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody({ signedDate: 0 })) })), configured);
    assert.equal(stale.status, 401, await stale.text());

    const missingOid = createTestChain({ leafOid: false });
    try {
      const withoutReceiptOid = await handleRetention(post(JSON.stringify({ signedPayload: signRealtimeRequest(missingOid, requestBody()) })), configured);
      assert.equal(withoutReceiptOid.status, 401, await withoutReceiptOid.text());
    } finally {
      missingOid.cleanup();
    }

    const fetches: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      fetches.push(url);
      return originalFetch(input, init);
    }) as typeof fetch;
    try {
      const timed = await handleRetention(new Request("http://127.0.0.1/retention-messaging-api", {
        method: "POST",
        headers: { "content-type": "application/json", "x-journeydeck-retention-timing": "1" },
        body: JSON.stringify({ signedPayload: productionPayload })
      }), configured);
      assert.equal(fetches.some(url => url.includes("onrender.com")), false);
      assert.equal(fetches.length, 0);
      const warmTiming = timed.headers.get("server-timing") || "";
      const dur = Number(/retention;dur=([0-9.]+)/.exec(warmTiming)?.[1]);
      const warmCpu = Number(/cpu;dur=([0-9.]+)/.exec(warmTiming)?.[1]);
      assert.equal(Number.isFinite(dur), true);
      assert.equal(dur < 10, true, `warm handler wall ${dur} ms`);
      if (Number.isFinite(warmCpu)) assert.equal(warmCpu < 10, true, `warm handler cpu ${warmCpu} ms`);
      console.log(`retention warm handler wall ${dur.toFixed(3)} ms${Number.isFinite(warmCpu) ? ` cpu ${warmCpu.toFixed(3)} ms` : ""}`);
    } finally {
      globalThis.fetch = originalFetch;
    }

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
