import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";
import {
  APP_STORE_PROVIDER_TOKEN,
  UTM_CAMPAIGN_STORAGE_KEY,
  UTM_SOURCE_STORAGE_KEY,
  X_HEADLINE_VARIANT,
  applyAppStoreCampaigns,
  applyHomeHeadlineVariant,
  buildAppleCampaignToken,
  clipUmamiValue,
  forwardAppStoreClickToUmami,
  initPublicCampaign,
  isAppStoreHref,
  readCampaignFromLanding,
  rewriteAppStoreHref,
  sanitizeCampaignToken,
  umamiAppStoreClickDetail
} from "../../web/campaign.js";

const UMAMI_TAG = '<script defer src="https://cloud.umami.is/script.js" data-website-id="a5f66e11-ec7d-4133-8e1a-f8e6c08593af" data-domains="journeydeck.me"></script>';

const APP_STORE_URL = "https://apps.apple.com/us/app/journeydeck/id6806502526";
const APPLE_CAMPAIGN_QUERY = "pt=129344416&ct=x-launch_oct13&mt=8";
const publicPages = [
  "/",
  "/apple-music-soundtrack",
  "/private-driving-journal",
  "/travel-journal-app-with-photos",
  "/road-trip-tracker-app",
  "/support",
  "/privacy",
  "/terms"
] as const;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string) {
      data[key] = String(value);
    }
  };
}

test("campaign token sanitizer keeps lowercase letters, digits, hyphens, and underscores", () => {
  assert.equal(sanitizeCampaignToken("X"), "x");
  assert.equal(sanitizeCampaignToken("Launch Oct"), "launch-oct");
  assert.equal(sanitizeCampaignToken("launch_oct13"), "launch_oct13");
  assert.equal(sanitizeCampaignToken("x_launch.oct"), "x_launch-oct");
  assert.equal(sanitizeCampaignToken("--Hello--World--"), "hello-world");
  assert.equal(sanitizeCampaignToken("!!!"), "");
  assert.equal(sanitizeCampaignToken("a".repeat(45)), "a".repeat(40));
  assert.equal(sanitizeCampaignToken(`${"a".repeat(39)}bcd`), `${"a".repeat(39)}b`);
  assert.equal(sanitizeCampaignToken(`${"a".repeat(39)}-zzz`), "a".repeat(39));
  assert.doesNotMatch(sanitizeCampaignToken(`${"a".repeat(39)}-zzz`), /-$/);
});

test("Apple campaign tokens combine source and campaign and stay within 40 characters", () => {
  assert.equal(buildAppleCampaignToken("x", "launch_oct13"), "x-launch_oct13");
  assert.equal(buildAppleCampaignToken("X", "Launch_Oct13"), "x-launch_oct13");
  assert.equal(buildAppleCampaignToken("x", "launch-oct"), "x-launch-oct");
  assert.equal(buildAppleCampaignToken("x", ""), "x");
  assert.equal(buildAppleCampaignToken("", "launch_oct13"), "launch_oct13");
  assert.equal(buildAppleCampaignToken("", ""), "");
  assert.equal(buildAppleCampaignToken("x", "a".repeat(50)).length, 40);
});

test("App Store href rewrite adds pt, ct, and mt with UTM, keeps HTML hrefs without UTM, and preserves see-all=reviews", () => {
  assert.equal(APP_STORE_PROVIDER_TOKEN, "129344416");
  assert.equal(rewriteAppStoreHref(APP_STORE_URL, "", ""), APP_STORE_URL);
  assert.equal(rewriteAppStoreHref(`${APP_STORE_URL}?see-all=reviews`, "", ""), `${APP_STORE_URL}?see-all=reviews`);
  assert.equal(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), `${APP_STORE_URL}?${APPLE_CAMPAIGN_QUERY}`);
  assert.equal(
    rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13", ""),
    `${APP_STORE_URL}?ct=x-launch_oct13&mt=8`
  );
  assert.equal(
    rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13", "123456"),
    `${APP_STORE_URL}?pt=123456&ct=x-launch_oct13&mt=8`
  );
  assert.equal(
    rewriteAppStoreHref(`${APP_STORE_URL}?see-all=reviews`, "x", "launch_oct13"),
    `${APP_STORE_URL}?see-all=reviews&${APPLE_CAMPAIGN_QUERY}`
  );
  assert.equal(
    rewriteAppStoreHref(`${APP_STORE_URL}?${APPLE_CAMPAIGN_QUERY}`, "x", "launch_oct13"),
    `${APP_STORE_URL}?${APPLE_CAMPAIGN_QUERY}`
  );
  assert.equal(
    rewriteAppStoreHref(`${APP_STORE_URL}?see-all=reviews&${APPLE_CAMPAIGN_QUERY}`, "x", "launch_oct13"),
    `${APP_STORE_URL}?see-all=reviews&${APPLE_CAMPAIGN_QUERY}`
  );
  assert.equal(rewriteAppStoreHref("/support", "x", "launch_oct13"), "/support");
  assert.equal(rewriteAppStoreHref("https://x.com/JourneyDeck", "x", "launch_oct13"), "https://x.com/JourneyDeck");
  assert.equal(isAppStoreHref(APP_STORE_URL), true);
  assert.equal(isAppStoreHref(`${APP_STORE_URL}?utm_medium=social`), true);
  assert.doesNotMatch(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /utm_/);
  assert.match(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /[?&]pt=129344416(?:&|$)/);
  assert.match(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /[?&]ct=x-launch_oct13(?:&|$)/);
  assert.match(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /[?&]mt=8(?:&|$)/);
  assert.doesNotMatch(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /(?:[?&]pt=.*){2}/);
  assert.doesNotMatch(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /(?:[?&]ct=.*){2}/);
  assert.doesNotMatch(rewriteAppStoreHref(APP_STORE_URL, "x", "launch_oct13"), /(?:[?&]mt=.*){2}/);
});

test("landing UTM values persist in session storage and other query params are ignored", () => {
  const first = memoryStorage();
  const fromUrl = readCampaignFromLanding(new URLSearchParams("utm_source=x&utm_medium=social&utm_campaign=launch_oct13&fbclid=abc"), first);
  assert.deepEqual(fromUrl, { source: "x", campaign: "launch_oct13" });
  assert.equal(first.data[UTM_SOURCE_STORAGE_KEY], "x");
  assert.equal(first.data[UTM_CAMPAIGN_STORAGE_KEY], "launch_oct13");
  assert.equal(Object.keys(first.data).join(","), `${UTM_SOURCE_STORAGE_KEY},${UTM_CAMPAIGN_STORAGE_KEY}`);

  const persisted = readCampaignFromLanding(new URLSearchParams(""), first);
  assert.deepEqual(persisted, { source: "x", campaign: "launch_oct13" });

  const ignored = readCampaignFromLanding(new URLSearchParams("utm_medium=social&ref=nav"), first);
  assert.deepEqual(ignored, { source: "x", campaign: "launch_oct13" });

  const sourceOnly = readCampaignFromLanding(new URLSearchParams("utm_source=x"), first);
  assert.deepEqual(sourceOnly, { source: "x", campaign: "" });
  assert.equal(first.data[UTM_CAMPAIGN_STORAGE_KEY], "");

  const dirty = memoryStorage();
  const cleaned = readCampaignFromLanding(new URLSearchParams("utm_source=X_Source!&utm_campaign=Launch Oct"), dirty);
  assert.deepEqual(cleaned, { source: "x_source", campaign: "launch-oct" });
  assert.equal(dirty.data[UTM_SOURCE_STORAGE_KEY], "x_source");
  assert.equal(dirty.data[UTM_CAMPAIGN_STORAGE_KEY], "launch-oct");
});

test("App Store anchors keep their exact href without UTM and gain pt, ct, and mt when a campaign is present", () => {
  const documentLike = {
    links: [
      { href: APP_STORE_URL },
      { href: `${APP_STORE_URL}?see-all=reviews` },
      { href: "/support" }
    ],
    querySelectorAll() {
      return this.links.map(link => ({
        getAttribute(name: string) {
          return name === "href" ? link.href : null;
        },
        setAttribute(name: string, value: string) {
          if (name === "href") link.href = value;
        }
      }));
    }
  };

  applyAppStoreCampaigns(documentLike, "", "");
  assert.deepEqual(documentLike.links.map(link => link.href), [APP_STORE_URL, `${APP_STORE_URL}?see-all=reviews`, "/support"]);

  applyAppStoreCampaigns(documentLike, "x", "launch_oct13");
  assert.deepEqual(documentLike.links.map(link => link.href), [
    `${APP_STORE_URL}?${APPLE_CAMPAIGN_QUERY}`,
    `${APP_STORE_URL}?see-all=reviews&${APPLE_CAMPAIGN_QUERY}`,
    "/support"
  ]);
});

test("the X headline variant replaces only #hero-title when the source is x", () => {
  assert.match(X_HEADLINE_VARIANT, /Keep the drive/);
  assert.match(X_HEADLINE_VARIANT, /Keep the song/);
  assert.doesNotMatch(X_HEADLINE_VARIANT, /[\u2013\u2014]/);
  const title = { innerHTML: 'Take the road.<br><span class="gold">Keep the story.</span>' };
  const documentLike = {
    querySelector(selector: string) {
      return selector === "#hero-title" ? title : null;
    }
  };
  applyHomeHeadlineVariant(documentLike, "twitter");
  assert.equal(title.innerHTML, 'Take the road.<br><span class="gold">Keep the story.</span>');
  applyHomeHeadlineVariant(documentLike, "X");
  assert.equal(title.innerHTML, X_HEADLINE_VARIANT);
});

test("App Store clicks dispatch a local custom event and forward it to Umami when present", () => {
  const events: Array<{ type: string; detail: Record<string, string> }> = [];
  const umamiCalls: Array<{ name: string; detail: Record<string, string> }> = [];
  const headerLink = {
    href: `${APP_STORE_URL}?ct=x-launch_oct13`,
    getAttribute(name: string) {
      return name === "href" ? this.href : null;
    },
    setAttribute(name: string, value: string) {
      if (name === "href") this.href = value;
    }
  };
  const documentListeners: Array<{ type: string; handler: (event: { target: { closest: () => typeof headerLink } }) => void }> = [];
  const windowListeners: Array<{ type: string; handler: (event: Event) => void }> = [];
  const documentLike = {
    querySelectorAll() {
      return [headerLink];
    },
    querySelector() {
      return null;
    },
    addEventListener(type: string, handler: (event: { target: { closest: () => typeof headerLink } }) => void) {
      documentListeners.push({ type, handler });
    }
  };
  const windowLike = {
    location: { search: "?utm_source=x&utm_campaign=launch_oct13", pathname: "/" },
    sessionStorage: memoryStorage(),
    document: documentLike,
    umami: {
      track(name: string, detail: Record<string, string>) {
        umamiCalls.push({ name, detail });
      }
    },
    addEventListener(type: string, handler: (event: Event) => void) {
      windowListeners.push({ type, handler });
    },
    dispatchEvent(event: Event) {
      const custom = event as CustomEvent<Record<string, string>>;
      events.push({ type: custom.type, detail: custom.detail });
      for (const listener of windowListeners) {
        if (listener.type === custom.type) listener.handler(custom);
      }
      return true;
    }
  };

  initPublicCampaign(windowLike, documentLike);
  const click = documentListeners.find(listener => listener.type === "click");
  assert.ok(click);
  click.handler({ target: { closest: () => headerLink } });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "journeydeck:appstore-click");
  assert.deepEqual(events[0].detail, {
    page: "/",
    source: "x",
    campaign: "launch_oct13",
    href: headerLink.href
  });
  assert.deepEqual(umamiCalls, [{ name: "appstore_click", detail: events[0].detail }]);
});

test("Umami click forward clips values to 200 characters and is a safe no-op when Umami is missing or throws", () => {
  const calls: Array<{ name: string; detail: ReturnType<typeof umamiAppStoreClickDetail> }> = [];
  const longPage = `/${"p".repeat(210)}`;
  const longHref = `${APP_STORE_URL}?${"h".repeat(210)}`;
  forwardAppStoreClickToUmami({
    umami: {
      track(name: string, detail: ReturnType<typeof umamiAppStoreClickDetail>) {
        calls.push({ name, detail });
      }
    }
  }, { page: longPage, source: "x", campaign: "launch_oct13", href: longHref });
  assert.equal(calls[0].name, "appstore_click");
  assert.equal(calls[0].detail.page, clipUmamiValue(longPage));
  assert.equal(calls[0].detail.page.length, 200);
  assert.equal(calls[0].detail.href, clipUmamiValue(longHref));
  assert.equal(calls[0].detail.href.length, 200);
  assert.equal(calls[0].detail.source, "x");
  assert.equal(calls[0].detail.campaign, "launch_oct13");
  const dirtyCalls: Array<{ name: string; detail: ReturnType<typeof umamiAppStoreClickDetail> }> = [];
  forwardAppStoreClickToUmami({
    umami: {
      track(name: string, detail: ReturnType<typeof umamiAppStoreClickDetail>) {
        dirtyCalls.push({ name, detail });
      }
    }
  }, { page: "/", source: "X_Source!", campaign: "Launch Oct", href: APP_STORE_URL });
  assert.deepEqual(dirtyCalls[0].detail, {
    page: "/",
    source: "x_source",
    campaign: "launch-oct",
    href: APP_STORE_URL
  });
  assert.doesNotThrow(() => forwardAppStoreClickToUmami({}, { page: "/", source: "x", campaign: "launch_oct13", href: APP_STORE_URL }));
  assert.doesNotThrow(() => forwardAppStoreClickToUmami({
    umami: {
      track() {
        throw new Error("blocked");
      }
    }
  }, { page: "/", source: "x", campaign: "launch_oct13", href: APP_STORE_URL }));
});

test("served public pages keep the plain App Store URL and load the first-party campaign script", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const script = await runtime.app.inject({ method: "GET", url: "/campaign.js?v=4" });
    assert.equal(script.statusCode, 200, script.body);
    assert.match(String(script.headers["content-type"]), /javascript/);
    assert.match(script.body, /APP_STORE_PROVIDER_TOKEN/);
    assert.match(script.body, /129344416/);
    assert.match(script.body, /journeydeck:appstore-click/);
    assert.match(script.body, /umami\?\.track/);
    assert.doesNotMatch(script.body, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|gtag|googletagmanager|analytics\.js/);
    assert.doesNotMatch(script.body, /[\u2013\u2014]/);

    for (const url of publicPages) {
      const page = await runtime.app.inject({ method: "GET", url });
      assert.equal(page.statusCode, 200, url);
      assert.match(page.body, /src="\/campaign\.js\?v=4"/, url);
      assert.ok(page.body.includes(UMAMI_TAG), url);
      assert.match(page.body, /data-domains="journeydeck\.me"/, url);
      assert.match(page.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526"/, url);
      assert.doesNotMatch(page.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526\?ct=/, url);
      assert.doesNotMatch(page.body, /googletagmanager|gtag\(|plausible|cloudflareinsights/i, url);
      assert.match(String(page.headers["content-security-policy"]), /script-src[^;]*https:\/\/cloud\.umami\.is/, url);
      assert.match(String(page.headers["content-security-policy"]), /connect-src[^;]*https:\/\/gateway\.umami\.is/, url);
      assert.doesNotMatch(String(page.headers["content-security-policy"]), /connect-src[^;]*https:\/\/cloud\.umami\.is/, url);
    }

    const home = await runtime.app.inject({ method: "GET", url: "/" });
    assert.match(home.body, /<h1 id="hero-title">Take the road\.<br><span class="gold">Keep the story\.<\/span><\/h1>/);
    assert.doesNotMatch(home.body, /Keep the drive/);

    for (const url of ["/login", "/index.html"]) {
      const privatePage = await runtime.app.inject({ method: "GET", url });
      assert.equal(privatePage.statusCode, 200, url);
      assert.doesNotMatch(privatePage.body, /cloud\.umami\.is/, url);
    }
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
