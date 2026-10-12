import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const cspDefaultSrc = /default-src 'self'/;

test("HSTS is sent only for HTTPS production web responses", async () => {
  const productionFixture = fixtureDatabase();
  const desktopFixture = fixtureDatabase();
  const httpOriginFixture = fixtureDatabase();
  const production = await createApp({
    databasePath: productionFixture.filename, root, allowTestAuth: true, legacyUpstream: "",
    mode: "web", publicOrigin: "https://journeydeck.me"
  });
  const desktop = await createApp({
    databasePath: desktopFixture.filename, root, allowTestAuth: true, legacyUpstream: "",
    mode: "desktop", publicOrigin: "https://journeydeck.me"
  });
  const httpOrigin = await createApp({
    databasePath: httpOriginFixture.filename, root, allowTestAuth: true, legacyUpstream: "",
    mode: "web", publicOrigin: "http://127.0.0.1:8791"
  });
  try {
    const httpsProduction = await production.app.inject({
      method: "GET", url: "/", headers: { "x-forwarded-proto": "https" }
    });
    assert.equal(httpsProduction.statusCode, 200, httpsProduction.body);
    assert.equal(httpsProduction.headers["strict-transport-security"], "max-age=31536000");
    assert.doesNotMatch(String(httpsProduction.headers["strict-transport-security"]), /includeSubDomains|preload/i);
    assert.match(String(httpsProduction.headers["content-security-policy"]), cspDefaultSrc);

    const httpProduction = await production.app.inject({ method: "GET", url: "/" });
    assert.equal(httpProduction.statusCode, 200, httpProduction.body);
    assert.equal(httpProduction.headers["strict-transport-security"], undefined);
    assert.match(String(httpProduction.headers["content-security-policy"]), cspDefaultSrc);

    const httpsDesktop = await desktop.app.inject({
      method: "GET", url: "/privacy", headers: { "x-forwarded-proto": "https" }
    });
    assert.equal(httpsDesktop.statusCode, 200, httpsDesktop.body);
    assert.equal(httpsDesktop.headers["strict-transport-security"], undefined);

    const httpsHttpOrigin = await httpOrigin.app.inject({
      method: "GET", url: "/", headers: { "x-forwarded-proto": "https" }
    });
    assert.equal(httpsHttpOrigin.statusCode, 200, httpsHttpOrigin.body);
    assert.equal(httpsHttpOrigin.headers["strict-transport-security"], undefined);
  } finally {
    await production.app.close();
    await desktop.app.close();
    await httpOrigin.app.close();
    productionFixture.cleanup();
    desktopFixture.cleanup();
    httpOriginFixture.cleanup();
  }
});
