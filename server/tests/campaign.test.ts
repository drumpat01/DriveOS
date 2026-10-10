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
  initPublicCampaign,
  isAppStoreHref,
  readCampaignFromLanding,
  rewriteAppStoreHref,
  sanitizeCampaignToken
} from "../../web/campaign.js";

const APP_STORE_URL = "https://apps.apple.com/us/app/journeydeck/id6806502526";
const publicPages = [
  "/",
  "/apple-music-soundtrack",
  "/private-driving-journal",
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

test("campaign token sanitizer keeps lowercase letters, digits, and hyphens", () => {
  assert.equal(sanitizeCampaignToken("X"), "x");
  assert.equal(sanitizeCampaignToken("Launch Oct"), "launch-oct");
  assert.equal(sanitizeCampaignToken("x_launch.oct"), "x-launch-oct");
  assert.equal(sanitizeCampaignToken("--Hello--World--"), "hello-world");
  assert.equal(sanitizeCampaignToken("!!!"), "");
  assert.equal(sanitizeCampaignToken("a".repeat(45)), "a".repeat(40));
  assert.equal(sanitizeCampaignToken(`${"a".repeat(39)}-zzz`).length, 40);
  assert.doesNotMatch(sanitizeCampaignToken(`${"a".repeat(39)}-zzz`), /-$/);
});

test("Apple campaign tokens combine source and campaign and stay within 40 characters", () => {
  assert.equal(buildAppleCampaignToken("x", "launch-oct"), "x-launch-oct");
  assert.equal(buildAppleCampaignToken("X", "Launch-Oct"), "x-launch-oct");
  assert.equal(buildAppleCampaignToken("x", ""), "x");
  assert.equal(buildAppleCampaignToken("", "launch-oct"), "launch-oct");
  assert.equal(buildAppleCampaignToken("", ""), "");
  assert.equal(buildAppleCampaignToken("x", "a".repeat(50)).length, 40);
});

test("App Store href rewrite adds ct, adds pt only when the provider token is set, and ignores other landing params", () => {
  assert.equal(APP_STORE_PROVIDER_TOKEN, "");
  assert.equal(rewriteAppStoreHref(APP_STORE_URL, "", ""), APP_STORE_URL);
  assert.equal(rewriteAppStoreHref(APP_STORE_URL, "x", "launch-oct"), `${APP_STORE_URL}?ct=x-launch-oct`);
  assert.equal(rewriteAppStoreHref(APP_STORE_URL, "x", "launch-oct", ""), `${APP_STORE_URL}?ct=x-launch-oct`);
  assert.equal(
    rewriteAppStoreHref(APP_STORE_URL, "x", "launch-oct", "123456"),
    `${APP_STORE_URL}?ct=x-launch-oct&pt=123456`
  );
  assert.equal(
    rewriteAppStoreHref(`${APP_STORE_URL}?see-all=reviews`, "x", "launch-oct"),
    `${APP_STORE_URL}?see-all=reviews&ct=x-launch-oct`
  );
  assert.equal(rewriteAppStoreHref("/support", "x", "launch-oct"), "/support");
  assert.equal(rewriteAppStoreHref("https://x.com/JourneyDeck", "x", "launch-oct"), "https://x.com/JourneyDeck");
  assert.equal(isAppStoreHref(APP_STORE_URL), true);
  assert.equal(isAppStoreHref(`${APP_STORE_URL}?utm_medium=social`), true);
  assert.doesNotMatch(rewriteAppStoreHref(APP_STORE_URL, "x", "launch-oct"), /utm_/);
});

test("landing UTM values persist in session storage and other query params are ignored", () => {
  const first = memoryStorage();
  const fromUrl = readCampaignFromLanding(new URLSearchParams("utm_source=x&utm_medium=social&utm_campaign=launch-oct&fbclid=abc"), first);
  assert.deepEqual(fromUrl, { source: "x", campaign: "launch-oct" });
  assert.equal(first.data[UTM_SOURCE_STORAGE_KEY], "x");
  assert.equal(first.data[UTM_CAMPAIGN_STORAGE_KEY], "launch-oct");
  assert.equal(Object.keys(first.data).join(","), `${UTM_SOURCE_STORAGE_KEY},${UTM_CAMPAIGN_STORAGE_KEY}`);

  const persisted = readCampaignFromLanding(new URLSearchParams(""), first);
  assert.deepEqual(persisted, { source: "x", campaign: "launch-oct" });

  const ignored = readCampaignFromLanding(new URLSearchParams("utm_medium=social&ref=nav"), first);
  assert.deepEqual(ignored, { source: "x", campaign: "launch-oct" });

  const sourceOnly = readCampaignFromLanding(new URLSearchParams("utm_source=x"), first);
  assert.deepEqual(sourceOnly, { source: "x", campaign: "" });
  assert.equal(first.data[UTM_CAMPAIGN_STORAGE_KEY], "");
});

test("App Store anchors keep their exact href without UTM and gain ct when a campaign is present", () => {
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

  applyAppStoreCampaigns(documentLike, "x", "launch-oct");
  assert.deepEqual(documentLike.links.map(link => link.href), [
    `${APP_STORE_URL}?ct=x-launch-oct`,
    `${APP_STORE_URL}?see-all=reviews&ct=x-launch-oct`,
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

test("App Store clicks dispatch a local custom event without making a network request", () => {
  const events: Array<{ type: string; detail: Record<string, string> }> = [];
  const headerLink = {
    href: `${APP_STORE_URL}?ct=x-launch-oct`,
    getAttribute(name: string) {
      return name === "href" ? this.href : null;
    },
    setAttribute(name: string, value: string) {
      if (name === "href") this.href = value;
    }
  };
  const listeners: Array<{ type: string; handler: (event: { target: { closest: () => typeof headerLink } }) => void }> = [];
  const documentLike = {
    querySelectorAll() {
      return [headerLink];
    },
    querySelector() {
      return null;
    },
    addEventListener(type: string, handler: (event: { target: { closest: () => typeof headerLink } }) => void) {
      listeners.push({ type, handler });
    }
  };
  const windowLike = {
    location: { search: "?utm_source=x&utm_campaign=launch-oct", pathname: "/" },
    sessionStorage: memoryStorage(),
    document: documentLike,
    dispatchEvent(event: Event) {
      const custom = event as CustomEvent<Record<string, string>>;
      events.push({ type: custom.type, detail: custom.detail });
      return true;
    }
  };

  initPublicCampaign(windowLike, documentLike);
  const click = listeners.find(listener => listener.type === "click");
  assert.ok(click);
  click.handler({ target: { closest: () => headerLink } });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "journeydeck:appstore-click");
  assert.deepEqual(events[0].detail, {
    page: "/",
    source: "x",
    campaign: "launch-oct",
    href: headerLink.href
  });
});

test("served public pages keep the plain App Store URL and load the first-party campaign script", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const script = await runtime.app.inject({ method: "GET", url: "/campaign.js?v=1" });
    assert.equal(script.statusCode, 200, script.body);
    assert.match(String(script.headers["content-type"]), /javascript/);
    assert.match(script.body, /APP_STORE_PROVIDER_TOKEN/);
    assert.match(script.body, /journeydeck:appstore-click/);
    assert.doesNotMatch(script.body, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|gtag|googletagmanager|analytics\.js/);
    assert.doesNotMatch(script.body, /[\u2013\u2014]/);

    for (const url of publicPages) {
      const page = await runtime.app.inject({ method: "GET", url });
      assert.equal(page.statusCode, 200, url);
      assert.match(page.body, /src="\/campaign\.js\?v=1"/, url);
      assert.match(page.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526"/, url);
      assert.doesNotMatch(page.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526\?ct=/, url);
      assert.doesNotMatch(page.body, /googletagmanager|gtag\(|plausible|cloudflareinsights/i, url);
    }

    const home = await runtime.app.inject({ method: "GET", url: "/" });
    assert.match(home.body, /<h1 id="hero-title">Take the road\.<br><span class="gold">Keep the story\.<\/span><\/h1>/);
    assert.doesNotMatch(home.body, /Keep the drive/);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
