import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, sign, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import { createApp } from "../src/app.js";
import { DEFAULT_RETENTION_MESSAGE_ID } from "../src/config.js";
import { APPLE_ROOT_CA_G3_SHA256, loadPinnedAppleRootCertificates } from "../src/retention-messaging.js";
import { fixtureDatabase, root } from "./helpers.js";

const extensionConfig = `[v3_intermediate]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
1.2.840.113635.100.6.2.1 = ASN1:NULL

[v3_leaf]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
1.2.840.113635.100.6.11.1 = ASN1:NULL
`;

type TestChain = {
  rootDer: Buffer;
  leafKeyPem: string;
  x5c: string[];
  cleanup: () => void;
};

function createTestChain(): TestChain {
  const directory = mkdtempSync(join(tmpdir(), "retention-chain-"));
  const ext = join(directory, "ext.cnf");
  writeFileSync(ext, extensionConfig);
  const openssl = (args: string[]) => execFileSync("openssl", args, { stdio: "pipe" });
  openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", join(directory, "root.key")]);
  openssl(["req", "-new", "-x509", "-key", join(directory, "root.key"), "-sha256", "-days", "3650", "-subj", "/CN=Test Apple Root CA G3", "-out", join(directory, "root.crt")]);
  openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", join(directory, "intermediate.key")]);
  openssl(["req", "-new", "-key", join(directory, "intermediate.key"), "-subj", "/CN=Test Apple WWDR", "-out", join(directory, "intermediate.csr")]);
  openssl(["x509", "-req", "-in", join(directory, "intermediate.csr"), "-CA", join(directory, "root.crt"), "-CAkey", join(directory, "root.key"), "-sha256", "-days", "3650", "-extfile", ext, "-extensions", "v3_intermediate", "-out", join(directory, "intermediate.crt")]);
  openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", join(directory, "leaf.key")]);
  openssl(["req", "-new", "-key", join(directory, "leaf.key"), "-subj", "/CN=Test App Store Receipt Signing", "-out", join(directory, "leaf.csr")]);
  openssl(["x509", "-req", "-in", join(directory, "leaf.csr"), "-CA", join(directory, "intermediate.crt"), "-CAkey", join(directory, "intermediate.key"), "-sha256", "-days", "3650", "-extfile", ext, "-extensions", "v3_leaf", "-out", join(directory, "leaf.crt")]);
  const leaf = new X509Certificate(readFileSync(join(directory, "leaf.crt")));
  const intermediate = new X509Certificate(readFileSync(join(directory, "intermediate.crt")));
  const rootCertificate = new X509Certificate(readFileSync(join(directory, "root.crt")));
  return {
    rootDer: rootCertificate.raw,
    leafKeyPem: readFileSync(join(directory, "leaf.key"), "utf8"),
    x5c: [leaf.raw, intermediate.raw, rootCertificate.raw].map(der => der.toString("base64")),
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  };
}

function signRealtimeRequest(chain: TestChain, payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", x5c: chain.x5c })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${header}.${body}`;
  const signature = sign("SHA256", Buffer.from(input), { key: createPrivateKey(chain.leafKeyPem), dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

function tamperSignature(jws: string) {
  const parts = jws.split(".");
  const signature = parts[2] || "";
  const flipped = signature.endsWith("A") ? `${signature.slice(0, -1)}B` : `${signature.slice(0, -1)}A`;
  return `${parts[0]}.${parts[1]}.${flipped}`;
}

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: "1000000000000001",
    appAppleId: 6806502526,
    productId: "com.journeydeck.recorder.pro.annual",
    userLocale: "en-US",
    requestIdentifier: "c03248af-dd76-4e9b-9c1e-4489cd19a768",
    environment: "Production",
    signedDate: Date.now(),
    ...overrides
  };
}

test("pinned Apple Root CA - G3 matches the published fingerprint", () => {
  const certificates = loadPinnedAppleRootCertificates(root);
  assert.equal(certificates.length, 1);
  assert.equal(createHash("sha256").update(certificates[0]).digest("hex"), APPLE_ROOT_CA_G3_SHA256);
  const certificate = new X509Certificate(certificates[0]);
  assert.match(certificate.subject, /Apple Root CA - G3/);
  assert.equal(certificate.issuer, certificate.subject);
});

test("Get Retention Message accepts a verified request and rejects invalid ones", async () => {
  const chain = createTestChain();
  const untrusted = createTestChain();
  const fixture = fixtureDatabase();
  const lines: string[] = [];
  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    }
  });
  const runtime = await createApp({
    databasePath: fixture.filename,
    root,
    allowTestAuth: false,
    legacyUpstream: "",
    mode: "web",
    publicOrigin: "https://journeydeck.me",
    retentionRootCertificates: [chain.rootDer],
    logStream
  });
  const desktopFixture = fixtureDatabase();
  const desktop = await createApp({
    databasePath: desktopFixture.filename,
    root,
    allowTestAuth: false,
    legacyUpstream: "",
    mode: "desktop",
    retentionRootCertificates: [chain.rootDer]
  });
  const sandboxFixture = fixtureDatabase();
  const sandboxOnly = await createApp({
    databasePath: sandboxFixture.filename,
    root,
    allowTestAuth: false,
    legacyUpstream: "",
    mode: "web",
    retentionRootCertificates: [chain.rootDer],
    retentionEnvironments: ["Sandbox"],
    retentionMessageId: "11111111-2222-4333-8444-555555555555"
  });
  try {
    const productionPayload = signRealtimeRequest(chain, requestBody());
    const started = Date.now();
    const accepted = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { origin: "https://evil.example", "content-type": "application/json; charset=utf-8", "x-journeydeck-test-auth": "wife" },
      payload: { signedPayload: productionPayload }
    });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.equal(Date.now() - started < 700, true);
    assert.equal(accepted.headers.location, undefined);
    assert.equal(accepted.headers["cache-control"], "no-store");
    assert.match(String(accepted.headers["content-type"]), /application\/json/);
    assert.deepEqual(accepted.json(), { message: { messageIdentifier: DEFAULT_RETENTION_MESSAGE_ID } });
    assert.equal(accepted.body.includes("1000000000000001"), false);
    assert.equal(accepted.body.includes(productionPayload), false);

    const slashed = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api/",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: signRealtimeRequest(chain, requestBody({ environment: "Sandbox", bundleId: "com.journeydeck.recorder" })) }
    });
    assert.equal(slashed.statusCode, 200, slashed.body);
    assert.equal(slashed.headers.location, undefined);
    assert.deepEqual(slashed.json(), { message: { messageIdentifier: DEFAULT_RETENTION_MESSAGE_ID } });

    const desktopAccepted = await desktop.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: productionPayload }
    });
    assert.equal(desktopAccepted.statusCode, 200, desktopAccepted.body);

    const badSignature = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: tamperSignature(productionPayload) }
    });
    assert.equal(badSignature.statusCode, 401, badSignature.body);
    assert.equal(badSignature.body.includes(productionPayload), false);
    assert.equal(badSignature.body.includes("1000000000000001"), false);

    const untrustedRoot = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: signRealtimeRequest(untrusted, requestBody()) }
    });
    assert.equal(untrustedRoot.statusCode, 401, untrustedRoot.body);

    const wrongBundle = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: signRealtimeRequest(chain, requestBody({ bundleId: "com.example.other" })) }
    });
    assert.equal(wrongBundle.statusCode, 403, wrongBundle.body);

    const wrongApp = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: signRealtimeRequest(chain, requestBody({ appAppleId: 1111111111, environment: "Sandbox" })) }
    });
    assert.equal(wrongApp.statusCode, 403, wrongApp.body);

    const wrongEnvironment = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: signRealtimeRequest(chain, requestBody({ environment: "Xcode" })) }
    });
    assert.equal(wrongEnvironment.statusCode, 403, wrongEnvironment.body);

    const sandboxDefault = await sandboxOnly.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: signRealtimeRequest(chain, requestBody({ environment: "Sandbox" })) }
    });
    assert.equal(sandboxDefault.statusCode, 200, sandboxDefault.body);
    assert.deepEqual(sandboxDefault.json(), { message: { messageIdentifier: "11111111-2222-4333-8444-555555555555" } });

    const productionWhenSandboxOnly = await sandboxOnly.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: productionPayload }
    });
    assert.equal(productionWhenSandboxOnly.statusCode, 403, productionWhenSandboxOnly.body);

    const malformed = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: {}
    });
    assert.equal(malformed.statusCode, 400, malformed.body);

    const notAJws = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: { signedPayload: "not-a-jws" }
    });
    assert.equal(notAJws.statusCode, 400, notAJws.body);

    const invalidJson = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "application/json" },
      payload: "{not json"
    });
    assert.equal(invalidJson.statusCode, 400, invalidJson.body);

    const wrongType = await runtime.app.inject({
      method: "POST",
      url: "/retention-messaging-api",
      headers: { "content-type": "text/plain" },
      payload: "hello"
    });
    assert.equal(wrongType.statusCode, 415, wrongType.body);

    const wrongMethod = await runtime.app.inject({ method: "GET", url: "/retention-messaging-api" });
    assert.equal(wrongMethod.statusCode, 405, wrongMethod.body);
    assert.equal(wrongMethod.headers.allow, "POST");
    assert.match(String(wrongMethod.headers["content-type"]), /application\/json/);

    const wrongMethodSlashed = await runtime.app.inject({ method: "PUT", url: "/retention-messaging-api/" });
    assert.equal(wrongMethodSlashed.statusCode, 405, wrongMethodSlashed.body);

    const logged = lines.join("\n");
    assert.equal(logged.includes("1000000000000001"), false);
    assert.equal(logged.includes(productionPayload), false);
    assert.match(logged, /c03248af-dd76-4e9b-9c1e-4489cd19a768/);
  } finally {
    await runtime.app.close();
    await desktop.app.close();
    await sandboxOnly.app.close();
    fixture.cleanup();
    desktopFixture.cleanup();
    sandboxFixture.cleanup();
    chain.cleanup();
    untrusted.cleanup();
  }
});
