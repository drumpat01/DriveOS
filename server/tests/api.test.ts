import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const auth = { "x-journeydeck-test-auth": "owner" };
const writeHeaders = { ...auth, origin: "http://127.0.0.1" };

function googleRobotsAllowed(robotsTxt: string, pathName: string) {
  const rules: Array<{ type: "allow" | "disallow"; pattern: string; length: number }> = [];
  for (const line of robotsTxt.split(/\r?\n/)) {
    const match = /^(Allow|Disallow):\s*(\S*)/i.exec(line.trim());
    if (!match || !match[2]) continue;
    const pattern = match[2];
    const regex = new RegExp(`^${pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`);
    if (regex.test(pathName)) rules.push({ type: match[1].toLowerCase() as "allow" | "disallow", pattern, length: pattern.length });
  }
  if (!rules.length) return true;
  rules.sort((left, right) => right.length - left.length || (left.type === "allow" ? -1 : 1));
  return rules[0].type === "allow";
}

function countMatches(html: string, pattern: RegExp) {
  return [...html.matchAll(pattern)].length;
}

function metaNameContent(html: string, name: string) {
  const match = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "i"));
  return match?.[1] ?? "";
}

function metaPropertyContent(html: string, property: string) {
  const match = html.match(new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`, "i"));
  return match?.[1] ?? "";
}

const studioLink = '<a class="nav-studio" href="https://studio.journeydeck.me">Studio <span aria-hidden="true">↗</span></a>';

function assertStudioNav(html: string, label: string) {
  const desktop = html.match(/<nav class="desktop-nav" aria-label="Main navigation">([\s\S]*?)<\/nav>/);
  const mobile = html.match(/<nav aria-label="Mobile navigation">([\s\S]*?)<\/nav>/);
  assert.ok(desktop, `${label} desktop nav`);
  assert.ok(mobile, `${label} mobile nav`);
  assert.equal(desktop[1].includes(studioLink), true, `${label} desktop Studio link`);
  assert.equal(mobile[1].includes(studioLink), true, `${label} mobile Studio link`);
  assert.equal(countMatches(desktop[1], /class="nav-studio"/g), 1, `${label} desktop Studio count`);
  assert.equal(countMatches(mobile[1], /class="nav-studio"/g), 1, `${label} mobile Studio count`);
  assert.equal(desktop[1].includes("style="), false, `${label} desktop inline style`);
  assert.equal(mobile[1].includes("style="), false, `${label} mobile inline style`);
}

function documentTitle(html: string) {
  return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
}

test("static web assets added after startup are served from the fixed web root", async () => {
  const fixture = fixtureDatabase(), webRoot = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-static-"));
  const runtime = await createApp({ databasePath: fixture.filename, root, webRoot, allowTestAuth: true, legacyUpstream: "" });
  try {
    fs.mkdirSync(path.join(webRoot, "features"), { recursive: true });
    fs.writeFileSync(path.join(webRoot, "moments.css"), ".moments-page{display:block}", "utf8");
    fs.writeFileSync(path.join(webRoot, "features", "moments.js"), "window.JourneyDeckMoments=true;", "utf8");
    const css = await runtime.app.inject({ method: "GET", url: "/moments.css?v=next" });
    const script = await runtime.app.inject({ method: "GET", url: "/features/moments.js?v=next" });
    assert.equal(css.statusCode, 200, css.body);
    assert.match(String(css.headers["content-type"]), /^text\/css/);
    assert.equal(script.statusCode, 200, script.body);
    assert.match(String(script.headers["content-type"]), /javascript/);
    assert.match(String(script.headers["content-security-policy"]), /https:\/\/sdk\.scdn\.co/);
    assert.match(String(script.headers["content-security-policy"]), /frame-src https:\/\/open\.spotify\.com/);
    assert.match(String(script.headers["permissions-policy"]), /autoplay=\(self "https:\/\/open\.spotify\.com"\).*encrypted-media=\(self "https:\/\/open\.spotify\.com"\)/);
  } finally {
    await runtime.app.close(); fixture.cleanup(); fs.rmSync(webRoot, { recursive: true, force: true });
  }
});

test("public information and discovery pages are accessible without an authenticated JourneyDeck session", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const privacy = await runtime.app.inject({ method: "GET", url: "/privacy" });
    const support = await runtime.app.inject({ method: "GET", url: "/support" });
    assert.equal(privacy.statusCode, 200, privacy.body);
    assert.match(String(privacy.headers["content-type"]), /text\/html/);
    assert.match(privacy.body, /JourneyDeck Privacy Policy/i);
    assert.match(privacy.body, /journeydeckapp@gmail\.com/i);
    assert.match(privacy.body, /Last updated:<\/strong> September 30, 2026/);
    assert.match(privacy.body, /RevenueCat/i);
    assert.match(privacy.body, /Connecting an AI assistant/);
    assert.match(privacy.body, /never writes to iCloud/);
    assert.match(privacy.body, /both your app-wide setting and that assistant’s setting allow it/);
    assert.match(privacy.body, /Optional Tessie connection/);
    assert.match(privacy.body, /Questions and answers are not saved and are not sent to JourneyDeck servers/);
    assert.match(privacy.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    assert.match(privacy.body, /\/public-page\.css\?v=grand-tour-4/);
    assert.equal(support.statusCode, 200, support.body);
    assert.match(String(support.headers["content-type"]), /text\/html/);
    assert.match(support.body, /JourneyDeck Support/i);
    assert.match(support.body, /Recording needs an iPhone/);
    assert.match(support.body, /Plus adds full history/);
    assert.doesNotMatch(support.body, /unlocks full history/);
    assert.doesNotMatch(support.body, /annual only/);
    assert.match(support.body, /\$39\.99\/yr(?!e)/);
    assert.doesNotMatch(support.body, /\$39\.99\/year/);
    assert.match(support.body, /7-day free trial/);
    assert.doesNotMatch(support.body, /0\.99|24\.99|3-day|per week|weekly/i);
    assert.match(support.body, /Restore Purchases is in Settings &gt; Membership/);
    assert.match(support.body, /items are still arriving/);
    assert.match(support.body, /mailto:journeydeckapp@gmail\.com/i);
    assert.match(support.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    const soundtrack = await runtime.app.inject({ method: "GET", url: "/apple-music-soundtrack" });
    assert.equal(soundtrack.statusCode, 200, soundtrack.body);
    assert.match(String(soundtrack.headers["content-type"]), /text\/html/);
    assert.match(soundtrack.body, /records drives and builds an optional soundtrack from your authorized Apple Music listening history/i);
    assert.match(soundtrack.body, /href="\/privacy"/);
    assert.match(soundtrack.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(soundtrack.body, /aria-current="page">Soundtracks<\/a>/);
    assert.match(soundtrack.body, /\/assets\/v2\/soundtrack-sample\.webp\?v=1/);
    assert.match(soundtrack.body, /width="600" height="1304"/);
    assert.match(soundtrack.body, /alt="JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives\."/);
    assert.doesNotMatch(soundtrack.body, /\/assets\/v2\/soundtrack\.(?:webp|jpg)|\/assets\/v4\/05-soundtrack\.webp/);
    assert.match(soundtrack.body, /Identify Song uses ShazamKit/);
    assert.match(soundtrack.body, /rel="preload" as="image"/);
    assert.match(soundtrack.body, /grand-touring-home-800\.webp\?v=1/);
    assert.match(soundtrack.body, /imagesrcset="/);
    assert.match(soundtrack.body, /imagesizes="/);
    assert.match(soundtrack.body, /fetchpriority="high"/);
    assert.match(soundtrack.body, /srcset="/);
    assert.doesNotMatch(soundtrack.body, /class="hero-photo"[^>]*loading="lazy"/);
    const journal = await runtime.app.inject({ method: "GET", url: "/private-driving-journal" });
    assert.equal(journal.statusCode, 200, journal.body);
    assert.match(String(journal.headers["content-type"]), /text\/html/);
    assert.match(journal.body, /<h1>Private driving journal for iPhone<\/h1>/);
    assert.match(journal.body, /JourneyDeck is a private driving journal for iPhone\. You manually start a journey/);
    assert.match(journal.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(journal.body, /What is a private driving journal app for iPhone\?/);
    assert.match(journal.body, /href="\/privacy"/);
    assert.match(journal.body, /href="\/apple-music-soundtrack"/);
    assert.match(journal.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(journal.body, /rel="canonical" href="https:\/\/journeydeck\.me\/private-driving-journal"/);
    assert.match(journal.body, /rel="preload" as="image"/);
    assert.match(journal.body, /grand-touring-home-800\.webp\?v=1/);
    assert.match(journal.body, /imagesrcset="/);
    assert.match(journal.body, /imagesizes="/);
    assert.match(journal.body, /fetchpriority="high"/);
    assert.match(journal.body, /srcset="/);
    assert.doesNotMatch(journal.body, /class="hero-photo"[^>]*loading="lazy"/);
    const roadTripJournal = await runtime.app.inject({ method: "GET", url: "/road-trip-journal-app" });
    assert.equal(roadTripJournal.statusCode, 200, roadTripJournal.body);
    assert.match(String(roadTripJournal.headers["content-type"]), /text\/html/);
    assert.match(roadTripJournal.body, /<h1>Road trip journal app for iPhone<\/h1>/);
    assert.match(roadTripJournal.body, /A private road trip journal for iPhone\. Start a journey, and JourneyDeck keeps the route, the miles and the music\./);
    assert.match(roadTripJournal.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(roadTripJournal.body, /What is a road trip journal app\?/);
    assert.match(roadTripJournal.body, /href="\/privacy"/);
    assert.match(roadTripJournal.body, /href="\/apple-music-soundtrack"/);
    assert.match(roadTripJournal.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(roadTripJournal.body, /rel="canonical" href="https:\/\/journeydeck\.me\/road-trip-journal-app"/);
    assert.match(roadTripJournal.body, /href="\/route-66-road-trip-journal"/);
    assert.match(roadTripJournal.body, /href="\/pacific-coast-highway-road-trip-journal"/);
    assert.match(roadTripJournal.body, /href="\/national-parks-road-trip-journal"/);
    assert.match(roadTripJournal.body, /href="\/texas-hill-country-road-trip-journal"/);
    assert.doesNotMatch(roadTripJournal.body, /[\u2013\u2014]/);
    const roadTripTracker = await runtime.app.inject({ method: "GET", url: "/road-trip-tracker-app" });
    assert.equal(roadTripTracker.statusCode, 200, roadTripTracker.body);
    assert.match(String(roadTripTracker.headers["content-type"]), /text\/html/);
    assert.match(roadTripTracker.body, /<h1>Road trip tracker app for iPhone<\/h1>/);
    assert.match(roadTripTracker.body, /Record the roads you choose\. JourneyDeck saves each route, its distance and drive time privately on your iPhone\./);
    assert.match(roadTripTracker.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(roadTripTracker.body, /Is there an iPhone app that tracks your route\?/);
    assert.match(roadTripTracker.body, /href="\/privacy"/);
    assert.match(roadTripTracker.body, /href="\/apple-music-soundtrack"/);
    assert.match(roadTripTracker.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(roadTripTracker.body, /rel="canonical" href="https:\/\/journeydeck\.me\/road-trip-tracker-app"/);
    assert.doesNotMatch(roadTripTracker.body, /[\u2013\u2014]/);
    const travelPhotos = await runtime.app.inject({ method: "GET", url: "/travel-journal-app-with-photos" });
    assert.equal(travelPhotos.statusCode, 200, travelPhotos.body);
    assert.match(String(travelPhotos.headers["content-type"]), /text\/html/);
    assert.match(travelPhotos.body, /<h1>Travel journal app with photos for iPhone<\/h1>/);
    assert.match(travelPhotos.body, /Group your drives into Memories, then add your own photos and notes\. The route, the pictures and the soundtrack stay together, privately on your iPhone\./);
    assert.match(travelPhotos.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(travelPhotos.body, /Is there a travel journal app with photos for iPhone\?/);
    assert.match(travelPhotos.body, /href="\/privacy"/);
    assert.match(travelPhotos.body, /href="\/apple-music-soundtrack"/);
    assert.match(travelPhotos.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(travelPhotos.body, /rel="canonical" href="https:\/\/journeydeck\.me\/travel-journal-app-with-photos"/);
    assert.doesNotMatch(travelPhotos.body, /[\u2013\u2014]/);
    const drivingHistory = await runtime.app.inject({ method: "GET", url: "/driving-history-app" });
    assert.equal(drivingHistory.statusCode, 200, drivingHistory.body);
    assert.match(String(drivingHistory.headers["content-type"]), /text\/html/);
    assert.match(drivingHistory.body, /<h1>Driving history app for iPhone<\/h1>/);
    assert.match(drivingHistory.body, /<p class="lede">A private history of the roads you choose to keep: routes, places, photos and the songs that played. All on your iPhone.<\/p>/);
    assert.match(drivingHistory.body, /THE ROAD \/ FREE/);
    assert.match(drivingHistory.body, /Manually start a journey on iPhone to save your route, distance, and drive time on your device/);
    assert.doesNotMatch(drivingHistory.body, /ATLAS \/ JOURNEYDECK PLUS/);
    assert.match(drivingHistory.body, /JourneyDeck is a personal drive journal, not a DMV driving record, not an insurance report, and not a mileage tax log/);
    assert.match(drivingHistory.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(drivingHistory.body, /Is this the same as Apple Maps drive history\?/);
    assert.match(drivingHistory.body, /href="\/privacy"/);
    assert.match(drivingHistory.body, /href="\/apple-music-soundtrack"/);
    assert.match(drivingHistory.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(drivingHistory.body, /rel="canonical" href="https:\/\/journeydeck\.me\/driving-history-app"/);
    assert.match(drivingHistory.body, /JourneyDeck Plus adds Atlas/);
    assert.doesNotMatch(drivingHistory.body, /unlocks Atlas/);
    assert.doesNotMatch(drivingHistory.body, /[\u2013\u2014]/);
    const route66 = await runtime.app.inject({ method: "GET", url: "/route-66-road-trip-journal" });
    assert.equal(route66.statusCode, 200, route66.body);
    assert.match(String(route66.headers["content-type"]), /text\/html/);
    assert.match(route66.body, /<h1>A Route 66 road trip journal that stays on your phone<\/h1>/);
    assert.match(route66.body, /<p class="lede">Keep your Route 66 drive in a private iPhone journal\. Your route, miles, music and photos, saved on your phone\. No account needed\.<\/p>/);
    assert.match(route66.body, /Route 66 turned 100 in 2026/);
    assert.doesNotMatch(route66.body, /Route 66 turns 100 this year/);
    assert.match(route66.body, /Before you pull out of Chicago \(or Santa Monica, I'm not judging\), tap Start Journey/);
    assert.match(route66.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(route66.body, /Does it track my Route 66 trip automatically\?/);
    assert.match(route66.body, /No\. Core recording works offline, which matters out in the Mojave\./);
    assert.match(route66.body, /No\. It won't tell you where the next neon sign is\. Use your guide for that\./);
    assert.match(route66.body, /href="\/privacy"/);
    assert.match(route66.body, /href="\/apple-music-soundtrack"/);
    assert.match(route66.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(route66.body, /rel="canonical" href="https:\/\/journeydeck\.me\/route-66-road-trip-journal"/);
    assert.doesNotMatch(route66.body, /[\u2013\u2014]/);
    const pacificCoast = await runtime.app.inject({ method: "GET", url: "/pacific-coast-highway-road-trip-journal" });
    assert.equal(pacificCoast.statusCode, 200, pacificCoast.body);
    assert.match(String(pacificCoast.headers["content-type"]), /text\/html/);
    assert.match(pacificCoast.body, /<h1>Keep your Pacific Coast Highway drive<\/h1>/);
    assert.match(pacificCoast.body, /<p class="lede">A private iPhone journal for Highway 1\. Route, miles and photos, saved on your phone\. Works offline, even where the signal doesn't\.<\/p>/);
    assert.match(pacificCoast.body, /Tap Start Journey before Big Sur, put the phone down and drive/);
    assert.match(pacificCoast.body, /Connect Apple Music if you want the playlist kept with the drive\./);
    assert.doesNotMatch(pacificCoast.body, /I always want to know what was playing/);
    assert.match(pacificCoast.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(pacificCoast.body, /Does it track my Pacific Coast Highway trip automatically\?/);
    assert.match(pacificCoast.body, /No\. You tap Start Journey when you set off and end it when you park\./);
    assert.match(pacificCoast.body, /No\. Signal disappears for long stretches along the coast, and core recording still works offline\./);
    assert.match(pacificCoast.body, /No\. It won't plan your stops\. It just keeps the trip\./);
    assert.match(pacificCoast.body, /href="\/privacy"/);
    assert.match(pacificCoast.body, /href="\/apple-music-soundtrack"/);
    assert.match(pacificCoast.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(pacificCoast.body, /rel="canonical" href="https:\/\/journeydeck\.me\/pacific-coast-highway-road-trip-journal"/);
    assert.doesNotMatch(pacificCoast.body, /[\u2013\u2014]/);
    const nationalParks = await runtime.app.inject({ method: "GET", url: "/national-parks-road-trip-journal" });
    assert.equal(nationalParks.statusCode, 200, nationalParks.body);
    assert.match(String(nationalParks.headers["content-type"]), /text\/html/);
    assert.match(nationalParks.body, /<h1>A road trip journal for your national parks trip<\/h1>/);
    assert.match(nationalParks.body, /National park trips are long days of driving between short moments you really want to keep/);
    assert.match(nationalParks.body, /You start it\. You stop it\./);
    assert.doesNotMatch(nationalParks.body, /Three kids\. Count again/);
    assert.match(nationalParks.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(nationalParks.body, /Does it track my national parks trip automatically\?/);
    assert.match(nationalParks.body, /No\. Nothing runs in the background\. You start it\. You stop it\./);
    assert.match(nationalParks.body, /No\. Lots of parks have little or no signal, and core recording works offline on your iPhone\./);
    assert.match(nationalParks.body, /href="\/privacy"/);
    assert.match(nationalParks.body, /href="\/apple-music-soundtrack"/);
    assert.match(nationalParks.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(nationalParks.body, /rel="canonical" href="https:\/\/journeydeck\.me\/national-parks-road-trip-journal"/);
    assert.doesNotMatch(nationalParks.body, /[\u2013\u2014]/);
    const hillCountry = await runtime.app.inject({ method: "GET", url: "/texas-hill-country-road-trip-journal" });
    assert.equal(hillCountry.statusCode, 200, hillCountry.body);
    assert.match(String(hillCountry.headers["content-type"]), /text\/html/);
    assert.match(hillCountry.body, /<h1>A Texas Hill Country road trip, kept<\/h1>/);
    assert.match(hillCountry.body, /I live in DFW, so the Hill Country is our "close" road trip/);
    assert.match(hillCountry.body, /Close in Texas means about four hours\./);
    assert.match(hillCountry.body, /Tap Start Journey when you leave the house/);
    assert.match(hillCountry.body, /Start a journey when you back out of the driveway and forget about it until you're eating brisket/);
    assert.match(hillCountry.body, /Keep the Apple Music soundtrack too\./);
    assert.match(hillCountry.body, /<a href="\/support">Would you use something like this for your next trip\? I'd love to know\.<\/a>/);
    assert.doesNotMatch(hillCountry.body, /kolaches/);
    assert.doesNotMatch(hillCountry.body, /George Strait/);
    assert.match(hillCountry.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(hillCountry.body, /Does it track my Hill Country trip automatically\?/);
    assert.match(hillCountry.body, /No\. It won't plan your stops or find the best peach stand\. It just keeps the drive\./);
    assert.match(hillCountry.body, /href="\/privacy"/);
    assert.match(hillCountry.body, /href="\/apple-music-soundtrack"/);
    assert.match(hillCountry.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(hillCountry.body, /rel="canonical" href="https:\/\/journeydeck\.me\/texas-hill-country-road-trip-journal"/);
    assert.doesNotMatch(hillCountry.body, /[\u2013\u2014]/);
    const teslaJournal = await runtime.app.inject({ method: "GET", url: "/tesla-drive-journal" });
    assert.equal(teslaJournal.statusCode, 200, teslaJournal.body);
    assert.match(String(teslaJournal.headers["content-type"]), /text\/html/);
    assert.match(teslaJournal.body, /<h1>The trip, later<\/h1>/);
    assert.match(teslaJournal.body, /Then you can replay the whole trip\. iPhone only\./);
    assert.match(teslaJournal.body, /the iPhone's GPS detects the drives/);
    assert.match(teslaJournal.body, /imports the car's drives and charging history from the last 30 days/);
    assert.match(teslaJournal.body, /Music &amp; Connections, and tap Connect Tessie/);
    assert.match(teslaJournal.body, /Generate Access Token/);
    assert.match(teslaJournal.body, /Tessie access token field/);
    assert.match(teslaJournal.body, /One tap or Siri\. Those are the Start Journey and Stop Journey shortcuts\./);
    assert.match(teslaJournal.body, /<p class="step-note">Tessie is a separate service, and any Tessie fees are separate\. The token stays in this iPhone's Keychain\.<\/p>/);
    assert.match(teslaJournal.body, /JourneyDeck Plus, \$39\.99\/yr, 7-day free trial for new subscribers\./);
    assert.match(teslaJournal.body, /<h2>What's free<\/h2>/);
    assert.match(teslaJournal.body, /Manual drive recording and route viewing/);
    assert.match(teslaJournal.body, /Today's journeys\./);
    assert.match(teslaJournal.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(teslaJournal.body, /"@type": "FAQPage"/);
    assert.match(teslaJournal.body, /What iPhone does it need\?/);
    assert.match(teslaJournal.body, /iOS 17 or later\./);
    assert.match(teslaJournal.body, /<nav class="desktop-nav" aria-label="Main navigation"><a href="\/">Home<\/a><a href="\/tesla-drive-journal" aria-current="page">Tesla<\/a><a href="\/apple-music-soundtrack">Soundtracks<\/a>/);
    assert.match(teslaJournal.body, /aria-label="Mobile navigation"><a href="\/">Home<\/a><a href="\/tesla-drive-journal" aria-current="page">Tesla<\/a><a href="\/apple-music-soundtrack">Soundtracks<\/a>/);
    assert.doesNotMatch(teslaJournal.body, /Tesla journal/);
    assert.match(teslaJournal.body, /href="\/public-a11y\.css\?v=2"/);
    assert.match(teslaJournal.body, /alt="A trip replay in JourneyDeck\. Not a Tesla drive\."/);
    assert.match(teslaJournal.body, /<figcaption>A trip replay in JourneyDeck\. Not a Tesla drive\.<\/figcaption>/);
    assert.match(teslaJournal.body, /alt="Atlas in JourneyDeck\. Not Tesla data\."/);
    assert.match(teslaJournal.body, /<figcaption>Atlas in JourneyDeck\. Not Tesla data\.<\/figcaption>/);
    assert.match(teslaJournal.body, /srcset="\/assets\/v4\/02-journey-screen-400\.webp\?v=1 400w, \/assets\/v4\/02-journey-screen\.webp\?v=1 516w"/);
    assert.match(teslaJournal.body, /srcset="\/assets\/v4\/06-atlas-400\.webp\?v=1 400w, \/assets\/v4\/06-atlas\.webp\?v=1 660w"/);
    assert.match(teslaJournal.body, /width="516" height="1108" loading="lazy"/);
    assert.match(teslaJournal.body, /width="660" height="1434" loading="lazy"/);
    assert.doesNotMatch(teslaJournal.body, /route-replay\.jpg|appstore-03/);
    const teslaFigures = teslaJournal.body.match(/<figure>[\s\S]*?<\/figure>/gi)?.join("\n") ?? "";
    assert.doesNotMatch(teslaFigures, /tessie/i);
    assert.match(teslaJournal.body, /rel="preload" as="image" href="\/assets\/beta\/grand-touring-home-800\.webp\?v=1"/);
    assert.match(teslaJournal.body, /class="hero has-photo"/);
    assert.match(teslaJournal.body, /class="hero-photo"/);
    assert.match(teslaJournal.body, /class="soundtrack-proof soundtrack-proof--pair"/);
    assert.match(teslaJournal.body, /class="lede tesla-lede"/);
    assert.equal((teslaJournal.body.match(/Start Journey/g) || []).length, 1);
    assert.equal((teslaJournal.body.match(/Stop Journey/g) || []).length, 1);
    const teslaVisible = teslaJournal.body.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.equal((teslaVisible.match(/JourneyDeck Plus, \$39\.99\/yr, 7-day free trial for new subscribers\./g) || []).length, 2);
    assert.equal((teslaVisible.match(/One tap or Siri\. Those are the Start Journey and Stop Journey shortcuts\./g) || []).length, 1);
    assert.equal((teslaVisible.match(/automatic drive and charging history with Tessie\./g) || []).length, 1);
    assert.doesNotMatch(teslaVisible, /a Plus feature/);
    assert.match(teslaJournal.body, /href="\/privacy"/);
    assert.match(teslaJournal.body, /href="\/apple-music-soundtrack"/);
    assert.match(teslaJournal.body, /class="contact" href="https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526\?pt=129344416&ct=tesla_page&mt=8">Download on the App Store/);
    assert.match(teslaJournal.body, /rel="canonical" href="https:\/\/journeydeck\.me\/tesla-drive-journal"/);
    assert.match(teslaJournal.body, /data-website-id="a5f66e11-ec7d-4133-8e1a-f8e6c08593af"/);
    assert.match(teslaJournal.body, /src="\/campaign\.js\?v=5"/);
    assert.match(String(teslaJournal.headers["content-security-policy"]), /script-src[^;]*https:\/\/cloud\.umami\.is/);
    assert.doesNotMatch(teslaJournal.body, /[\u2013\u2014]/);
    // The old ban also rejected "free trial" and "plus trial". Only 3-day stays forbidden.
    assert.doesNotMatch(teslaJournal.body, /3-day|0\.99|2\.99|24\.99|weekly|monthly|CarPlay|Bluetooth|motion trigger|the car records|navigation app/i);
    const journalAlias = await runtime.app.inject({ method: "GET", url: "/driving-journal" });
    assert.equal(journalAlias.statusCode, 301);
    assert.equal(journalAlias.headers.location, "/private-driving-journal");
    const homeworld = await runtime.app.inject({ method: "GET", url: "/homeworld" });
    assert.equal(homeworld.statusCode, 301);
    assert.equal(homeworld.headers.location, "https://studio.journeydeck.me/homeworld");
    const homeworldSlash = await runtime.app.inject({ method: "GET", url: "/homeworld/" });
    assert.equal(homeworldSlash.statusCode, 301);
    assert.equal(homeworldSlash.headers.location, "https://studio.journeydeck.me/homeworld");
    const homeworldHead = await runtime.app.inject({ method: "HEAD", url: "/homeworld" });
    assert.equal(homeworldHead.statusCode, 301);
    assert.equal(homeworldHead.headers.location, "https://studio.journeydeck.me/homeworld");
    const homeworldSlashHead = await runtime.app.inject({ method: "HEAD", url: "/homeworld/" });
    assert.equal(homeworldSlashHead.statusCode, 301);
    assert.equal(homeworldSlashHead.headers.location, "https://studio.journeydeck.me/homeworld");
    const homeworldQuery = await runtime.app.inject({ method: "GET", url: "/homeworld?from=old" });
    assert.equal(homeworldQuery.statusCode, 301);
    assert.equal(homeworldQuery.headers.location, "https://studio.journeydeck.me/homeworld");
    const terms = await runtime.app.inject({ method: "GET", url: "/terms" });
    assert.equal(terms.statusCode, 200, terms.body);
    assert.match(terms.body, /JourneyDeck Terms of Use/i);
    for (const page of [privacy, support, soundtrack, journal, roadTripJournal, roadTripTracker, travelPhotos, drivingHistory, route66, pacificCoast, nationalParks, hillCountry, teslaJournal, terms]) {
      assert.match(page.body, /class="site-header"/);
      assert.match(page.body, /class="desktop-nav" aria-label="Main navigation"/);
      assert.match(page.body, /href="\/apple-music-soundtrack"/);
      assert.match(page.body, /class="mobile-menu"/);
      assert.match(page.body, /Get the app/);
      assertStudioNav(page.body, "public page");
    }
    const robots = await runtime.app.inject({ method: "GET", url: "/robots.txt" });
    assert.equal(robots.statusCode, 200, robots.body);
    assert.match(robots.body, /^Content-Signal: ai-train=no, search=yes, ai-input=yes$/m);
    assert.doesNotMatch(robots.body, /ai-input=no/);
    assert.match(robots.body, /Sitemap: https:\/\/journeydeck\.me\/sitemap\.xml/i);
    assert.match(robots.body, /^Allow: \/$/m);
    assert.match(robots.body, /^Disallow: \/app\$$/m);
    assert.match(robots.body, /^Disallow: \/app\/$/m);
    assert.doesNotMatch(robots.body, /^Disallow: \/app$/m);
    assert.doesNotMatch(robots.body, /^Disallow: \/login$/m);
    assert.doesNotMatch(robots.body, /Disallow: \/beta/i);
    assert.doesNotMatch(robots.body, /Disallow: \/google8e611381b21882a8\.html/i);
    assert.equal(googleRobotsAllowed(robots.body, "/apple-music-soundtrack"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/private-driving-journal"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/road-trip-journal-app"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/road-trip-tracker-app"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/travel-journal-app-with-photos"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/driving-history-app"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/route-66-road-trip-journal"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/pacific-coast-highway-road-trip-journal"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/national-parks-road-trip-journal"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/texas-hill-country-road-trip-journal"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/tesla-drive-journal"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/google8e611381b21882a8.html"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/login"), true);
    assert.equal(googleRobotsAllowed(robots.body, "/app"), false);
    assert.equal(googleRobotsAllowed(robots.body, "/app/x"), false);
    assert.equal(googleRobotsAllowed(robots.body, "/api/x"), false);
    assert.equal(googleRobotsAllowed(robots.body, "/wife"), false);
    assert.equal(googleRobotsAllowed(robots.body, "/wife.html"), false);
    assert.equal(googleRobotsAllowed(robots.body, "/wife/extra"), false);
    const catalog = await runtime.app.inject({ method: "GET", url: "/.well-known/api-catalog" });
    assert.equal(catalog.statusCode, 200, catalog.body);
    assert.match(String(catalog.headers["content-type"]), /^application\/linkset\+json/i);
    const entry = JSON.parse(catalog.body).linkset[0];
    assert.ok(entry.anchor && entry["service-desc"] && entry["service-doc"] && entry.status);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/openapi.json" })).statusCode, 200);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api-docs" })).statusCode, 200);
    const authMd = await runtime.app.inject({ method: "GET", url: "/auth.md" });
    assert.equal(authMd.statusCode, 200, authMd.body);
    assert.match(String(authMd.headers["content-type"]), /markdown/i);
    assert.match(authMd.body, /^# .*auth\.md/im);
    const sitemap = await runtime.app.inject({ method: "GET", url: "/sitemap.xml" });
    assert.equal(sitemap.statusCode, 200, sitemap.body);
    assert.match(String(sitemap.headers["content-type"]), /xml/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/terms<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/apple-music-soundtrack<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/private-driving-journal<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/road-trip-journal-app<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/road-trip-tracker-app<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/travel-journal-app-with-photos<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/driving-history-app<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/route-66-road-trip-journal<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/pacific-coast-highway-road-trip-journal<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/national-parks-road-trip-journal<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/texas-hill-country-road-trip-journal<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/tesla-drive-journal<\/loc>/i);
    assert.doesNotMatch(sitemap.body, /<loc>https:\/\/journeydeck\.me\/(?:beta|app|login)(?:\/|<)/i);
    assert.doesNotMatch(sitemap.body, /google8e611381b21882a8/i);
    assert.doesNotMatch(sitemap.body, /wife/i);
    assert.doesNotMatch(sitemap.body, /llms\.txt/i);
    const llms = await runtime.app.inject({ method: "GET", url: "/llms.txt" });
    assert.equal(llms.statusCode, 200, llms.body);
    assert.match(String(llms.headers["content-type"]), /^text\/plain\b/i);
    assert.equal(llms.headers["x-robots-tag"], undefined);
    assert.match(llms.body, /You start each drive yourself/);
    assert.match(llms.body, /view the route, the photos, and the music/);
    assert.match(llms.body, /\$39\.99\/yr(?!e)/);
    assert.match(llms.body, /https:\/\/journeydeck\.me\/\n/);
    assert.match(llms.body, /https:\/\/journeydeck\.me\/tesla-drive-journal/);
    assert.match(llms.body, /https:\/\/journeydeck\.me\/support/);
    assert.match(llms.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.doesNotMatch(llms.body, /3-day|0\.99|24\.99|\$39\.99\/year/);
    const googleVerification = await runtime.app.inject({ method: "GET", url: "/google8e611381b21882a8.html" });
    assert.equal(googleVerification.statusCode, 200, googleVerification.body);
    assert.equal(googleVerification.body.replace(/\r?\n$/, ""), "google-site-verification: google8e611381b21882a8.html");
    const arbitraryHtml = await runtime.app.inject({ method: "GET", url: "/loading-preview.html" });
    assert.equal(arbitraryHtml.statusCode, 302, arbitraryHtml.body);
    assert.equal(arbitraryHtml.headers.location, "/login");
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("hosted root serves the Grand Touring launch page while private routes stay separate", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const landing = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(landing.statusCode, 200, landing.body);
    assert.match(String(landing.headers["content-type"]), /text\/html/);
    const links = String(landing.headers.link);
    for (const rel of ["api-catalog", "service-desc", "service-doc", "describedby"]) assert.match(links, new RegExp(`rel="${rel}"`));
    assert.match(landing.body, /GRAND TOURING/);
    assert.match(landing.body, /JOURNEYDECK 4\.0/);
    assert.match(landing.body, /href="\/beta\.css\?v=grand-tour-7"/);
    assertStudioNav(landing.body, "/");
    assert.match(landing.body, /id="medallion-theme"/);
    assert.match(landing.body, /data-theme="redline"/);
    assert.match(landing.body, /aria-label="1 of 5: Today"/);
    assert.match(landing.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(landing.body, /https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
    assert.match(landing.body, /IPAD \/ YOUR LIBRARY/);
    assert.match(landing.body, /property="og:image" content="https:\/\/journeydeck\.me\/assets\/beta\/share-card\.png\?v=1"/);
    assert.match(landing.body, /name="twitter:image" content="https:\/\/journeydeck\.me\/assets\/beta\/share-card\.png\?v=1"/);
    assert.match(landing.body, /name="twitter:card" content="summary_large_image"/);
    assert.match(landing.body, /APPLE WATCH \/ PAIRED IPHONE/);
    assert.match(landing.body, /<meta name="google-site-verification" content="C9F75mNcVf450GCL_J5RBoD5NRkqRig1EwwXUrr0P-w" \/>/);
    assert.match(String(landing.headers["content-security-policy"]), /default-src 'self'/);
    assert.match(String(landing.headers["content-security-policy"]), /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/);
    assert.match(String(landing.headers["content-security-policy"]), /connect-src[^;]*https:\/\/cloudflareinsights\.com/);
    assert.match(String(landing.headers["content-security-policy"]), /img-src[^;]*https:\/\/tools\.launchllama\.co/);
    assert.doesNotMatch(String(landing.headers["content-security-policy"]), /(?:script-src|connect-src)[^;]*https:\/\/tools\.launchllama\.co/);
    assert.match(landing.body, /href="https:\/\/tools\.launchllama\.co\/products\/journeydeck\?utm_source=badge&utm_medium=referral"/);
    assert.match(landing.body, /src="https:\/\/tools\.launchllama\.co\/featured-badge-white\.jpg\?v=5"/);
    assert.match(landing.body, /alt="Featured on Launch"/);
    assert.match(landing.body, /width="200" height="52"/);
    assert.match(landing.body, /href="https:\/\/launchmcp\.co\/\?utm_source=badge&utm_medium=referral"/);
    assert.match(landing.body, />Launch MCP<\/a>/);
    assert.doesNotMatch(landing.body, /<a href="\/login">Sign in<\/a>/);
    assert.match(landing.body, /<a href="https:\/\/studio\.journeydeck\.me\/\?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink">From the studio: Road Trip templates<\/a>/);
    assert.match(landing.body, /rel="canonical" href="https:\/\/journeydeck\.me\/"/);
    assert.match(landing.body, /property="og:url" content="https:\/\/journeydeck\.me\/"/);
    assert.doesNotMatch(landing.body, /href="\/login"/i);
    assert.match(landing.body, /href="#medallions"/);
    assert.match(landing.body, /href="\/apple-music-soundtrack"/);
    assert.match(landing.body, /class="feature-cta" href="\/apple-music-soundtrack"/);
    assert.match(landing.body, /class="feature-cta" href="\/private-driving-journal">See the private driving journal overview/);
    assert.match(landing.body, /class="feature-cta" href="\/road-trip-journal-app">See the road trip journal app/);
    assert.match(landing.body, /id="replay"/);
    assert.match(landing.body, /class="feature-cta" href="\/road-trip-tracker-app">See the road trip tracker app/);
    assert.match(landing.body, /id="memories"/);
    assert.match(landing.body, /class="feature-cta" href="\/travel-journal-app-with-photos">See the travel journal with photos/);
    assert.match(landing.body, /id="templates"/);
    assert.match(landing.body, /FROM THE STUDIO/);
    assert.match(landing.body, /Plan the next one\.<br><span class="gold">Road Trip templates\.<\/span>/);
    assert.match(landing.body, /data-umami-event="templates-click" href="https:\/\/studio\.journeydeck\.me\/\?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink">See the templates/);
    assert.match(landing.body, /id="membership"/);
    assert.match(landing.body, /class="feature-cta" href="\/driving-history-app">See the driving history app/);
    assert.match(landing.body, /<h1 id="hero-title">A road trip journal<br><span class="gold">for your iPhone\.<\/span><\/h1>/);
    assert.match(landing.body, /Your journal lives on your device\. No account required\./);
    assert.match(landing.body, /Your drives, and the music you played\. Tesla owners can connect Tessie with Plus so drives and charging record automatically\./);
    assert.match(landing.body, /class="feature-cta" href="\/tesla-drive-journal">See the Tesla drive journal/);
    assert.match(landing.body, /Ask JourneyDeck/);
    assert.match(landing.body, /Journey Markers/);
    assert.match(landing.body, /Start a Journey widget/);
    assert.match(landing.body, /Cinematic Dark, Rosewater, Autumn Drive, and Aurora Glass/);
    assert.match(landing.body, /class="mobile-menu"/);
    assert.match(landing.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    assert.match(landing.body, /Follow @JourneyDeck on X/i);
    assert.doesNotMatch(landing.body, /noindex|2\.0 PREVIEW|Coming soon for iPhone|Follow the launch|latest 45 days|JOURNEYDECK 2\.0/);
    assert.doesNotMatch(landing.body, /@JourneyDeckApp|x\.com\/JourneyDeckApp/i);

    const googleVerification = await runtime.app.inject({ method: "GET", url: "/google8e611381b21882a8.html" });
    assert.equal(googleVerification.statusCode, 200, googleVerification.body);
    assert.equal(googleVerification.body.replace(/\r?\n$/, ""), "google-site-verification: google8e611381b21882a8.html");
    assert.match(String(googleVerification.headers["content-security-policy"]), /default-src 'self'/);
    assert.doesNotMatch(String(googleVerification.headers["content-security-policy"]), /google-site-verification/);

    for (const [url, mime] of [
      ["/beta.css?v=grand-tour-7", /text\/css/],
      ["/public-page.css?v=grand-tour-4", /text\/css/],
      ["/public-page.css?v=hero-lcp-2", /text\/css/],
      ["/site-mobile-nav.css?v=2", /text\/css/],
      ["/v2-features.css?v=1", /text\/css/],
      ["/soundtrack-v2.css?v=1", /text\/css/],
      ["/assets/v4/02-journey.webp", /image\/webp/],
      ["/assets/v4/05-soundtrack-sample.webp", /image\/webp/],
      ["/assets/v2/soundtrack-sample.webp", /image\/webp/],
      ["/assets/v2/soundtrack-sample.webp?v=1", /image\/webp/],
      ["/assets/v2/soundtrack-sample.jpg", /image\/jpeg/],
      ["/assets/v4/04-memory.webp", /image\/webp/],
      ["/assets/v4/08-themes.webp", /image\/webp/],
      ["/login-grand-touring.css?v=grand-tour-1", /text\/css/],
      ["/beta.js?v=v4-1", /javascript/],
      ["/campaign.js?v=5", /javascript/],
      ["/medallions/medallions.css?v=medallions-2", /text\/css/],
      ["/medallions/medallions.js?v=medallions-2", /javascript/],
      ["/medallions/catalog.js", /javascript/],
      ["/medallions/viewer.js?v=medallions-1", /javascript/],
      ["/assets/medallions/soundtrack-100-dark.webp", /image\/webp/],
      ["/assets/medallions/story-collector-light-thumb.webp", /image\/webp/],
      ["/assets/beta/grand-touring-home.webp", /image\/webp/],
      ["/assets/beta/grand-touring-home-800.webp?v=1", /image\/webp/],
      ["/assets/beta/grand-touring-home-1600.webp?v=1", /image\/webp/],
      ["/assets/beta/share-card.png", /image\/png/],
      ["/assets/beta/journeydeck-pulse.svg", /image\/svg/],
      ...["01-today", "03-memories", "06-atlas", "07-ask"].map(name => [`/assets/v4/${name}.webp`, /image\/webp/] as const)
    ] as const) {
      const asset = await runtime.app.inject({ method: "GET", url });
      assert.equal(asset.statusCode, 200, url);
      assert.match(String(asset.headers["content-type"]), mime, url);
    }

    assert.equal(landing.body.includes("/assets/v4/05-soundtrack.webp"), false);
    assert.equal(landing.body.includes("/assets/v2/soundtrack.webp"), false);
    assert.equal(landing.body.includes("/assets/v2/soundtrack.jpg"), false);
    assert.match(landing.body, /data-feature="Soundtrack"[\s\S]*?src="\/assets\/v4\/05-soundtrack-sample\.webp" width="660" height="1434" alt="JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives\."/);
    assert.match(landing.body, /class="showcase-visual"[^>]*><img src="\/assets\/v4\/02-journey\.webp" width="660" height="1434"/);
    for (const url of ["/assets/v4/05-soundtrack.webp", "/assets/v2/soundtrack.webp", "/assets/v2/soundtrack.webp?v=1", "/assets/v2/soundtrack.jpg"]) {
      const removed = await runtime.app.inject({ method: "GET", url });
      assert.equal(removed.statusCode, 404, url);
      assert.doesNotMatch(String(removed.headers["content-type"] || ""), /image\//, url);
      assert.doesNotMatch(String(removed.headers["cache-control"] || ""), /immutable|max-age=31536000|max-age=604800/, url);
    }

    for (const url of ["/beta", "/beta/", "/beta.html", "/landing.html"]) {
      const retiredLanding = await runtime.app.inject({ method: "GET", url });
      assert.equal(retiredLanding.statusCode, 404, url);
      assert.match(retiredLanding.body, /Page not found/i, url);
      assert.equal(retiredLanding.headers["x-robots-tag"], "noindex, nofollow", url);
    }
    const nestedBeta = await runtime.app.inject({ method: "GET", url: "/beta/private" });
    assert.equal(nestedBeta.statusCode, 404);
    assert.match(nestedBeta.body, /Page not found/i);
    assert.equal(nestedBeta.headers["x-robots-tag"], "noindex, nofollow");

    const missing = await runtime.app.inject({ method: "GET", url: "/a-page-that-does-not-exist" });
    assert.equal(missing.statusCode, 404, missing.body);
    assert.match(missing.body, /Page not found/i);
    assert.equal(missing.headers["x-robots-tag"], "noindex, nofollow");
    assertStudioNav(missing.body, "404");
    const betaCss = await runtime.app.inject({ method: "GET", url: "/beta.css?v=grand-tour-7" });
    const publicCss = await runtime.app.inject({ method: "GET", url: "/public-page.css?v=grand-tour-4" });
    const mobileCss = await runtime.app.inject({ method: "GET", url: "/site-mobile-nav.css?v=2" });
    assert.match(betaCss.body, /\.desktop-nav \.nav-studio \{ color: var\(--gold\); font-weight: 500; \}/);
    assert.match(betaCss.body, /\.desktop-nav a:hover \{ color: var\(--ivory\); \}/);
    assert.match(publicCss.body, /\.desktop-nav \.nav-studio \{ color: var\(--gold\); font-weight: 500; \}/);
    assert.match(publicCss.body, /\.desktop-nav a:hover, \.desktop-nav a\[aria-current="page"\] \{ color: var\(--ivory\); \}/);
    assert.match(publicCss.body, /\.card ol \+ \.step-note \{ margin-top: 16px; \}/);
    assert.match(mobileCss.body, /\.mobile-menu \.nav-studio \{ color: var\(--gold\); font-weight: 500; \}/);
    assert.match(mobileCss.body, /\.mobile-menu nav a:hover, \.mobile-menu nav a\[aria-current="page"\] \{ background: #d4b15a22; color: #ead4a1; \}/);
    const missingApi = await runtime.app.inject({ method: "GET", url: "/api/a-page-that-does-not-exist" });
    assert.equal(missingApi.statusCode, 401);

    const login = await runtime.app.inject({ method: "GET", url: "/login" });
    assert.equal(login.statusCode, 200, login.body);
    assert.match(login.body, /JourneyDeck Sign In/i);
    assert.match(login.body, /<meta name="robots" content="noindex, nofollow">/);
    assert.equal(login.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(login.body, /\/login-grand-touring\.css\?v=grand-tour-1/);
    assert.match(login.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    const loginHtml = await runtime.app.inject({ method: "GET", url: "/login.html" });
    assert.equal(loginHtml.statusCode, 200, loginHtml.body);
    assert.equal(loginHtml.headers["x-robots-tag"], "noindex, nofollow");
    const indexHtml = await runtime.app.inject({ method: "GET", url: "/index.html" });
    assert.equal(indexHtml.statusCode, 200, indexHtml.body);
    assert.equal(indexHtml.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(String(indexHtml.headers["content-type"]), /text\/html/);
    assert.ok(fs.readFileSync(path.join(root, "web", "assets", "favicon.png")).equals(fs.readFileSync(path.join(root, "web", "assets", "journeydeck-cinematic-192.png"))));

    const privateApp = await runtime.app.inject({ method: "GET", url: "/app" });
    assert.equal(privateApp.statusCode, 302, privateApp.body);
    assert.equal(privateApp.headers.location, "/login");
    assert.equal(privateApp.headers["x-robots-tag"], "noindex, nofollow");

    const authenticatedApp = await runtime.app.inject({ method: "GET", url: "/app", headers: auth });
    assert.equal(authenticatedApp.statusCode, 200, authenticatedApp.body);
    assert.equal(authenticatedApp.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(String(authenticatedApp.headers["content-type"]), /text\/html/);
    assert.match(authenticatedApp.body, /JourneyDeck/i);
    const callback = await runtime.app.inject({ method: "GET", url: "/spotify-callback", headers: auth });
    assert.equal(callback.statusCode, 200, callback.body);
    assert.equal(callback.headers["x-robots-tag"], "noindex, nofollow");

    const loginScript = fs.readFileSync(path.join(root, "web", "login.js"), "utf8");
    assert.match(loginScript, /window\.location\.replace\("\/app"\)/);
    assert.doesNotMatch(loginScript, /window\.location\.replace\("\/"\)/);
    const wifeScript = fs.readFileSync(path.join(root, "web", "wife.js"), "utf8");
    assert.match(wifeScript, /location\.replace\("\/app"\)/);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "web", "manifest.webmanifest"), "utf8"));
    assert.equal(manifest.start_url, "/app#dashboard");
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("wife.html uses the same session gate and robots tag as /wife", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  const wifePageUrls = ["/wife.html", "/wife%2ehtml", "/wife%2Ehtml", "/%77ife.html", "/%77ife", "/wife.html?v=1", "/Wife.html", "/WIFE.HTML", "/wife.html/", "/wife/"];
  try {
    const wife = await runtime.app.inject({ method: "GET", url: "/wife" });
    assert.equal(wife.statusCode, 302, wife.body);
    assert.equal(wife.headers.location, "/login");
    assert.equal(wife.headers["x-robots-tag"], "noindex, nofollow");
    for (const url of wifePageUrls) {
      for (const method of ["GET", "HEAD"] as const) {
        const response = await runtime.app.inject({ method, url });
        const baseline = await runtime.app.inject({ method, url: "/wife" });
        assert.equal(response.statusCode, baseline.statusCode, `${method} ${url}`);
        assert.equal(response.headers.location, baseline.headers.location, `${method} ${url}`);
        assert.equal(response.headers["x-robots-tag"], baseline.headers["x-robots-tag"], `${method} ${url}`);
        assert.equal(response.body.includes("Wife Mode"), false, `${method} ${url}`);
      }
    }
    const authenticatedWife = await runtime.app.inject({ method: "GET", url: "/wife", headers: auth });
    const authenticatedHtml = await runtime.app.inject({ method: "GET", url: "/wife.html", headers: auth });
    const authenticatedEncoded = await runtime.app.inject({ method: "GET", url: "/wife%2ehtml", headers: auth });
    const authenticatedWifeRole = await runtime.app.inject({ method: "GET", url: "/wife.html", headers: { "x-journeydeck-test-auth": "wife" } });
    assert.equal(authenticatedWife.statusCode, 200, authenticatedWife.body);
    assert.equal(authenticatedHtml.statusCode, 200, authenticatedHtml.body);
    assert.equal(authenticatedHtml.body, authenticatedWife.body);
    assert.equal(authenticatedEncoded.statusCode, 200, authenticatedEncoded.body);
    assert.equal(authenticatedEncoded.body, authenticatedWife.body);
    assert.equal(authenticatedWifeRole.statusCode, 200, authenticatedWifeRole.body);
    assert.match(authenticatedHtml.body, /<title>Wife Mode · JourneyDeck<\/title>/);
    assert.match(String(authenticatedHtml.headers["content-type"]), /text\/html/);
    assert.equal(authenticatedHtml.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(authenticatedWife.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(authenticatedEncoded.headers["x-robots-tag"], "noindex, nofollow");
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("public marketing pages expose one title, description, canonical, Open Graph tags, and valid JSON-LD", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  const pages = [
    { url: "/", canonical: "https://journeydeck.me/" },
    { url: "/apple-music-soundtrack", canonical: "https://journeydeck.me/apple-music-soundtrack" },
    { url: "/private-driving-journal", canonical: "https://journeydeck.me/private-driving-journal" },
    { url: "/road-trip-journal-app", canonical: "https://journeydeck.me/road-trip-journal-app" },
    { url: "/road-trip-tracker-app", canonical: "https://journeydeck.me/road-trip-tracker-app" },
    { url: "/travel-journal-app-with-photos", canonical: "https://journeydeck.me/travel-journal-app-with-photos" },
    { url: "/driving-history-app", canonical: "https://journeydeck.me/driving-history-app" },
    { url: "/route-66-road-trip-journal", canonical: "https://journeydeck.me/route-66-road-trip-journal" },
    { url: "/pacific-coast-highway-road-trip-journal", canonical: "https://journeydeck.me/pacific-coast-highway-road-trip-journal" },
    { url: "/national-parks-road-trip-journal", canonical: "https://journeydeck.me/national-parks-road-trip-journal" },
    { url: "/texas-hill-country-road-trip-journal", canonical: "https://journeydeck.me/texas-hill-country-road-trip-journal" },
    { url: "/tesla-drive-journal", canonical: "https://journeydeck.me/tesla-drive-journal" },
    { url: "/support", canonical: "https://journeydeck.me/support" },
    { url: "/privacy", canonical: "https://journeydeck.me/privacy" },
    { url: "/terms", canonical: "https://journeydeck.me/terms" }
  ] as const;
  const rewrittenDescriptions = new Set(["/support", "/privacy", "/private-driving-journal", "/road-trip-journal-app", "/road-trip-tracker-app", "/travel-journal-app-with-photos", "/driving-history-app", "/route-66-road-trip-journal", "/pacific-coast-highway-road-trip-journal", "/national-parks-road-trip-journal", "/texas-hill-country-road-trip-journal", "/tesla-drive-journal"]);
  try {
    for (const page of pages) {
      const response = await runtime.app.inject({ method: "GET", url: page.url });
      assert.equal(response.statusCode, 200, page.url);
      const html = response.body;
      assert.equal(countMatches(html, /<title\b[^>]*>[\s\S]*?<\/title>/gi), 1, `${page.url} title`);
      assert.equal(countMatches(html, /<meta\s+name="description"/gi), 1, `${page.url} description`);
      assert.equal(countMatches(html, /<link\s+rel="canonical"/gi), 1, `${page.url} canonical`);
      assert.ok(html.includes(`rel="canonical" href="${page.canonical}"`), `${page.url} canonical href`);
      assert.match(html, /property="og:title"/);
      assert.match(html, /property="og:description"/);
      assert.ok(html.includes(`property="og:url" content="${page.canonical}"`), `${page.url} og:url`);
      assert.match(html, /property="og:image"/);
      const description = metaNameContent(html, "description");
      assert.ok(description, `${page.url} description content`);
      if (rewrittenDescriptions.has(page.url)) assert.doesNotMatch(description, /[\u2013\u2014]/, page.url);
      if (page.url === "/") {
        assert.doesNotMatch(documentTitle(html), /[\u2013\u2014]/, "home title");
        assert.doesNotMatch(metaPropertyContent(html, "og:title"), /[\u2013\u2014]/, "home og:title");
      }
      if (page.url === "/privacy" || page.url === "/terms") {
        assert.doesNotMatch(description, /\$39\.99|7-day free trial/, `${page.url} meta price`);
        assert.doesNotMatch(metaPropertyContent(html, "og:description"), /\$39\.99|7-day free trial/, `${page.url} og price`);
      }
      const offers: Array<{ price?: unknown; priceCurrency?: unknown; url?: unknown; availability?: unknown; priceSpecification?: { "@type"?: unknown; price?: unknown; priceCurrency?: unknown; billingDuration?: unknown } }> = [];
      const visitJson = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(visitJson);
          return;
        }
        const record = node as { "@type"?: unknown };
        if (record["@type"] === "Offer") offers.push(record as { price?: unknown; priceCurrency?: unknown; url?: unknown; availability?: unknown; priceSpecification?: { "@type"?: unknown; price?: unknown; priceCurrency?: unknown; billingDuration?: unknown } });
        Object.values(record).forEach(visitJson);
      };
      for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
        const parsed = JSON.parse(block[1]);
        visitJson(parsed);
      }
      assert.ok(offers.length > 0, `${page.url} offer`);
      for (const offer of offers) {
        assert.equal(offer.price, "39.99", `${page.url} offer price`);
        assert.equal(offer.priceCurrency, "USD", `${page.url} offer currency`);
        assert.equal(offer.availability, "https://schema.org/InStock", `${page.url} offer availability`);
        assert.match(String(offer.url), /^https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526\?pt=129344416&ct=[a-z0-9_]+&mt=8$/, `${page.url} offer url`);
        assert.ok(html.includes(`href="${offer.url}"`), `${page.url} offer url is already used on the page`);
        assert.equal(offer.priceSpecification?.["@type"], "UnitPriceSpecification", `${page.url} price specification`);
        assert.equal(offer.priceSpecification?.price, "39.99", `${page.url} billing price`);
        assert.equal(offer.priceSpecification?.priceCurrency, "USD", `${page.url} billing currency`);
        assert.equal(offer.priceSpecification?.billingDuration, "P1Y", `${page.url} billing duration`);
      }
      assert.ok(description.length <= 155, `${page.url} description is ${description.length}`);
      const ogDescription = metaPropertyContent(html, "og:description");
      assert.ok(ogDescription.length > 0 && ogDescription.length <= 155, `${page.url} og:description is ${ogDescription.length}`);
      const twitterDescription = metaNameContent(html, "twitter:description");
      if (twitterDescription) assert.ok(twitterDescription.length <= 155, `${page.url} twitter:description is ${twitterDescription.length}`);
      const speaksToYou = (value: string) => /\b(you|your|yours|yourself)\b/i.test(value) && !/\b(I|we|us|our|ours|my|mine)\b/.test(value);
      assert.equal(speaksToYou(description), true, `${page.url} description voice`);
      assert.equal(speaksToYou(ogDescription), true, `${page.url} og voice`);
      if (twitterDescription) assert.equal(speaksToYou(twitterDescription), true, `${page.url} twitter voice`);
      if (page.url === "/") assert.match(description, /^Your private journal/, `${page.url} description`);
      if (page.url === "/road-trip-journal-app") assert.match(description, /^Your private road trip journal/, `${page.url} description`);
      if (page.url === "/tesla-drive-journal") {
        assert.match(description, /drives and charging history/, `${page.url} description`);
        assert.match(html, /data-umami-event="plus-trial-click"/);
        assert.match(html, /Try the free trial of JourneyDeck Plus, then \$39\.99 a year\. <span aria-hidden="true">↗<\/span>/);
        assert.match(html, /JourneyDeck Plus, \$39\.99\/yr, 7-day free trial for new subscribers/, `${page.url} price`);
        assert.doesNotMatch(html, /\$39\.99\/year/, `${page.url} old annual wording`);
      } else {
        assert.match(html, /\$39\.99\/yr(?!e)/, `${page.url} price`);
        assert.doesNotMatch(html, /\$39\.99\/year/, `${page.url} old annual wording`);
      }
      assert.match(html, /7-day free trial/, `${page.url} trial`);
      assert.match(html, /"@type": "Offer"/, `${page.url} offer`);
      assert.doesNotMatch(html, /3-day/i, `${page.url} 3-day`);
      assert.doesNotMatch(html, /0\.99/, `${page.url} weekly price`);
      assert.doesNotMatch(html, /24\.99/, `${page.url} old annual price`);
      assert.equal(html.includes("/assets/v4/05-soundtrack.webp"), false, page.url);
      assert.equal(html.includes("/assets/v2/soundtrack.webp"), false, page.url);
      assert.equal(html.includes("/assets/v2/soundtrack.jpg"), false, page.url);
    }
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("hosted home and Support HTML advertise annual Plus and ban only the 3-day trial wording", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const home = await runtime.app.inject({ method: "GET", url: "/" });
    const support = await runtime.app.inject({ method: "GET", url: "/support" });
    assert.equal(home.statusCode, 200, home.body);
    assert.equal(support.statusCode, 200, support.body);
    for (const [name, body] of [["home", home.body], ["Support", support.body]] as const) {
      assert.match(body, /\$39\.99\/yr(?!e)/, name);
      assert.doesNotMatch(body, /\$39\.99\/year/, name);
      assert.match(body, /7-day free trial/, name);
      assert.doesNotMatch(body, /annual only/, name);
      // Previously this also banned "Plus trial". That ban is replaced by a 3-day ban only.
      assert.doesNotMatch(body, /3-day/, name);
      assert.doesNotMatch(body, /0\.99/, name);
    }
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("hosted cache headers distinguish versioned assets, unversioned images, and short-lived documents", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const versionedCss = await runtime.app.inject({ method: "GET", url: "/beta.css?v=grand-tour-7" });
    assert.equal(versionedCss.statusCode, 200, versionedCss.body);
    assert.equal(versionedCss.headers["cache-control"], "public, max-age=31536000, immutable");

    for (const url of ["/assets/beta/grand-touring-home-800.webp?v=1", "/assets/beta/grand-touring-home-1600.webp?v=1"]) {
      const versionedHero = await runtime.app.inject({ method: "GET", url });
      assert.equal(versionedHero.statusCode, 200, url);
      assert.match(String(versionedHero.headers["content-type"]), /image\/webp/, url);
      assert.equal(versionedHero.headers["cache-control"], "public, max-age=31536000, immutable", url);
    }

    const missingVersionedCss = await runtime.app.inject({ method: "GET", url: "/missing.css?v=new" });
    assert.equal(missingVersionedCss.statusCode, 404);
    assert.notEqual(missingVersionedCss.headers["cache-control"], "public, max-age=31536000, immutable");

    const unversionedImage = await runtime.app.inject({ method: "GET", url: "/assets/v4/02-journey.webp" });
    assert.equal(unversionedImage.statusCode, 200, unversionedImage.body);
    assert.equal(unversionedImage.headers["cache-control"], "public, max-age=604800");

    for (const [url, mime, cacheControl] of [
      ["/assets/v4/05-soundtrack-sample.webp", /image\/webp/, "public, max-age=604800"],
      ["/assets/v2/soundtrack-sample.jpg", /image\/jpeg/, "public, max-age=604800"],
      ["/assets/v2/soundtrack-sample.webp?v=1", /image\/webp/, "public, max-age=31536000, immutable"]
    ] as const) {
      const sample = await runtime.app.inject({ method: "GET", url });
      assert.equal(sample.statusCode, 200, url);
      assert.match(String(sample.headers["content-type"]), mime, url);
      assert.equal(sample.headers["cache-control"], cacheControl, url);
    }

    for (const url of ["/assets/v4/05-soundtrack.webp", "/assets/v2/soundtrack.webp?v=1", "/assets/v2/soundtrack.jpg"]) {
      const removed = await runtime.app.inject({ method: "GET", url });
      assert.equal(removed.statusCode, 404, url);
      assert.doesNotMatch(String(removed.headers["cache-control"] || ""), /immutable|max-age=31536000|max-age=604800/, url);
    }

    const unversionedMedallion = await runtime.app.inject({ method: "GET", url: "/assets/medallions/soundtrack-100-dark.webp" });
    assert.equal(unversionedMedallion.statusCode, 200, unversionedMedallion.body);
    assert.equal(unversionedMedallion.headers["cache-control"], "public, max-age=604800");

    for (const url of ["/", "/login", "/robots.txt", "/llms.txt", "/sitemap.xml", "/manifest.webmanifest", "/service-worker.js", "/build.json", "/login.js"]) {
      const response = await runtime.app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 200, url);
      assert.equal(response.headers["cache-control"], "public, max-age=0", url);
    }

    const bootstrap = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth });
    assert.equal(bootstrap.statusCode, 200, bootstrap.body);
    assert.equal(bootstrap.headers["cache-control"], "private, no-cache");
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("desktop root continues to serve only the authenticated private app", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "desktop" });
  try {
    const anonymous = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(anonymous.statusCode, 302, anonymous.body);
    assert.equal(anonymous.headers.location, "/login");
    const authenticated = await runtime.app.inject({ method: "GET", url: "/", headers: auth });
    assert.equal(authenticated.statusCode, 200, authenticated.body);
    assert.match(authenticated.body, /JourneyDeck/i);
    assert.equal(authenticated.body.includes("/assets/v4/05-soundtrack.webp"), false);
    assert.equal(authenticated.body.includes("/assets/v2/soundtrack.webp"), false);
    assert.equal(authenticated.body.includes("/assets/v2/soundtrack.jpg"), false);
    const wife = await runtime.app.inject({ method: "GET", url: "/wife" });
    const wifeHtml = await runtime.app.inject({ method: "GET", url: "/wife.html" });
    assert.equal(wife.statusCode, 302);
    assert.equal(wife.headers.location, "/login");
    assert.equal(wifeHtml.statusCode, wife.statusCode);
    assert.equal(wifeHtml.headers.location, wife.headers.location);
    assert.equal(wife.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(wifeHtml.headers["x-robots-tag"], "noindex, nofollow");
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("Atlas API enforces auth, origin, roles, and durable serialized writes", async () => {
  const fixture = fixtureDatabase();
  const options = { databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", publicOrigin: "http://127.0.0.1" };
  let runtime = await createApp(options);
  try {
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap" })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/spotify/player/session" })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { "tailscale-user-login": "spoofed@example.com" } })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).statusCode, 200);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, origin: "https://evil.invalid" } })).statusCode, 403);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, host: "127.0.0.1:8791", origin: "http://127.0.0.1:8791" } })).statusCode, 202);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, host: "127.0.0.1:8791", origin: "http://127.0.0.1:8792" } })).statusCode, 403);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { "x-journeydeck-test-auth": "wife", origin: "http://127.0.0.1" } })).statusCode, 403);
    const original = JSON.parse((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).body);
    const places = original.places.filter((item: any) => item.category !== "home").slice(0, 2);
    for (const [index, place] of places.entries()) {
      const response = await runtime.app.inject({ method: "POST", url: "/api/atlas/places/label", headers: writeHeaders, payload: { placeId: place.id, name: index ? "Walmart - Saginaw" : "Home", category: index ? "errands" : "home", latitude: place.latitude, longitude: place.longitude, radiusFeet: 200 } });
      assert.equal(response.statusCode, 200, response.body);
    }
    const patternIds = original.patterns.slice(0, 2).map((item: any) => item.id);
    assert.equal((await runtime.app.inject({ method: "POST", url: `/api/atlas/patterns/${patternIds[0]}/confirm`, headers: writeHeaders, payload: { type: "frequent-route" } })).statusCode, 200);
    assert.equal((await runtime.app.inject({ method: "POST", url: `/api/atlas/patterns/${patternIds[1]}/dismiss`, headers: writeHeaders })).statusCode, 200);
    const after = JSON.parse((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).body);
    assert.equal(after.places.find((item: any) => item.id === places[0].id).label, "Home");
    assert.equal(after.places.find((item: any) => item.id === places[1].id).label, "Walmart - Saginaw");
    assert.equal(after.patterns.length, 10);
    assert.equal(after.patterns.some((item: any) => patternIds.includes(item.id)), false);
    assert.equal(new Set(after.patterns.map((item: any) => item.id)).size, 10);
    await runtime.app.close();
    runtime = await createApp(options);
    const refreshed = JSON.parse((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).body);
    assert.equal(refreshed.places.find((item: any) => item.id === places[0].id).label, "Home");
    assert.equal(refreshed.places.find((item: any) => item.id === places[1].id).label, "Walmart - Saginaw");
    assert.equal(refreshed.patterns.some((item: any) => patternIds.includes(item.id)), false);
  } finally { await runtime.app.close().catch(() => {}); fixture.cleanup(); }
});

test("hosted Spotify playback returns a browser PKCE authorization configuration", async () => {
  const fixture = fixtureDatabase(), publicOrigin = "https://journeydeck.me";
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", publicOrigin, mode: "web", spotifyClientId: "spotify-test-client" });
  try {
    const response = await runtime.app.inject({ method: "POST", url: "/api/spotify/player/connect", headers: { ...auth, origin: publicOrigin }, payload: {} });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(JSON.parse(response.body), { mode: "pkce", clientId: "spotify-test-client", redirectUri: "https://journeydeck.me/spotify-callback" });
    const callback = await runtime.app.inject({ method: "GET", url: "/spotify-callback?code=test&state=test", headers: auth });
    assert.equal(callback.statusCode, 200, callback.body);
    assert.match(String(callback.headers["content-type"]), /text\/html/);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("bootstrap is private, ETagged, compressed, and contains no journey archive", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const response = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { ...auth, "accept-encoding": "br" } });
    assert.equal(response.statusCode, 200); assert.equal(response.headers["cache-control"], "private, no-cache"); assert.ok(response.headers.etag); assert.equal(response.headers["content-encoding"], "br");
    const conditional = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { ...auth, "if-none-match": String(response.headers.etag) } }); assert.equal(conditional.statusCode, 304);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("Atlas journey map is bounded, progressive, private, and contains no place labels", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const world = "west=-180&south=-90&east=180&north=90";
    assert.equal((await runtime.app.inject({ method: "GET", url: `/api/atlas/map?${world}&zoom=4` })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/map?west=5&south=5&east=1&north=9&zoom=4", headers: auth })).statusCode, 400);
    const overviewResponse = await runtime.app.inject({ method: "GET", url: `/api/atlas/map?${world}&zoom=4`, headers: auth });
    assert.equal(overviewResponse.statusCode, 200, overviewResponse.body); assert.equal(overviewResponse.headers["cache-control"], "private, max-age=30");
    const overview = JSON.parse(overviewResponse.body); assert.equal(overview.mode, "corridors"); assert.equal(overview.totalInView, 2100); assert.ok(overview.returned <= 500); assert.ok(overview.data.features.every((item: any) => item.properties.kind === "corridor" && !item.properties.journeyId));
    const detailResponse = await runtime.app.inject({ method: "GET", url: `/api/atlas/map?${world}&zoom=11`, headers: auth });
    assert.equal(detailResponse.statusCode, 200, detailResponse.body); const detail = JSON.parse(detailResponse.body);
    assert.equal(detail.mode, "journeys"); assert.equal(detail.returned, 1200); assert.equal(detail.truncated, true); assert.ok(detail.data.features.every((item: any) => item.properties.kind === "journey" && item.properties.journeyId));
    assert.doesNotMatch(detailResponse.body, /startingLocation|endingLocation|raw_payload|Resolved place|Walmart/i);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("snapshot rebuild runs off the request thread and preserves the last valid snapshot", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const before = runtime.store.status(); runtime.store.scheduleRebuild(0);
    const started = performance.now(), immediate = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth });
    assert.equal(immediate.statusCode, 200); assert.ok(performance.now() - started < 300);
    const deadline = Date.now() + 5000; while (runtime.store.status().dirty && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    const after = runtime.store.status(); assert.equal(after.dirty, false); assert.equal(after.lastError, null); assert.notEqual(after.snapshotId, before.snapshotId);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("readiness stays live when the compatibility API is unavailable", async () => {
  let healthHost = "";
  const upstream = http.createServer((req, res) => { healthHost = String(req.headers.host || ""); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, publicOrigin: "https://journeydeck.me" });
  try {
    const ready = await runtime.app.inject({ method: "GET", url: "/readyz" });
    assert.equal(ready.statusCode, 200);
    assert.equal(JSON.parse(ready.body).ok, true);
    assert.equal(JSON.parse(ready.body).legacyCompatibilityReachable, true);
    assert.equal(healthHost, "journeydeck.me");
    await new Promise<void>(resolve => upstream.close(() => resolve()));
    const unavailable = await runtime.app.inject({ method: "GET", url: "/readyz" });
    assert.equal(unavailable.statusCode, 200);
    assert.equal(JSON.parse(unavailable.body).ok, true);
    assert.equal(JSON.parse(unavailable.body).legacyCompatibilityReachable, false);
  } finally {
    await runtime.app.close().catch(() => {});
    if (upstream.listening) await new Promise<void>(resolve => upstream.close(() => resolve()));
    fixture.cleanup();
  }
});

test("lazy compatibility does not block readiness or public pages", async () => {
  let requests = 0;
  const upstream = http.createServer((_req, res) => { requests++; res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const fixture = fixtureDatabase(), runtime = await createApp({
    databasePath: fixture.filename, root, allowTestAuth: true, compatibilityLazy: true, mode: "web",
    legacyUpstream: `http://127.0.0.1:${address.port}`, publicOrigin: "https://journeydeck.me"
  });
  try {
    const ready = await runtime.app.inject({ method: "GET", url: "/readyz" });
    const home = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(ready.statusCode, 200);
    assert.equal(JSON.parse(ready.body).legacyCompatibilityReachable, false);
    assert.equal(home.statusCode, 200);
    assert.equal(requests, 0);
  } finally { await runtime.app.close(); await new Promise<void>(resolve => upstream.close(() => resolve())); fixture.cleanup(); }
});

test("legacy compatibility is explicit, passes reads, and blocks production writes", async () => {
  let requests = 0;
  const seen: Array<{ url?: string; host?: string; forwardedHost?: string; origin?: string }> = [];
  const upstream = http.createServer((req, res) => { requests++; seen.push({ url: req.url, host: req.headers.host, forwardedHost: String(req.headers["x-forwarded-host"] || ""), origin: req.headers.origin }); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(req.url === "/api/auth/session" ? { authenticated: true, role: "owner", email: "owner@example.com" } : { compatible: true, method: req.method })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve)); const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const previewOrigin = "https://preview.journeydeck.test";
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, legacyReadOnly: true, publicOrigin: previewOrigin });
  try {
    const read = await runtime.app.inject({ method: "GET", url: "/api/status", headers: auth }); assert.equal(read.statusCode, 200); assert.equal(JSON.parse(read.body).compatible, true);
    const computedRead = await runtime.app.inject({ method: "POST", url: "/api/drive/share-card", headers: { ...auth, origin: previewOrigin }, payload: { driveId: "fixture" } }); assert.equal(computedRead.statusCode, 200);
    const login = await runtime.app.inject({ method: "POST", url: "/api/auth/login", headers: { host: "preview.journeydeck.test", origin: previewOrigin }, payload: { email: "owner@example.com", password: "test" } }); assert.equal(login.statusCode, 200);
    const passkey = await runtime.app.inject({ method: "POST", url: "/api/auth/passkey/options", headers: { host: "preview.journeydeck.test", origin: previewOrigin }, payload: {} }); assert.equal(passkey.statusCode, 200);
    assert.deepEqual(seen.slice(-2), [
      { url: "/api/auth/login", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: previewOrigin },
      { url: "/api/auth/passkey/options", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: previewOrigin }
    ]);
    const sessionRead = await runtime.app.inject({ method: "GET", url: "/api/status", headers: { cookie: "DriveOSSession=production-host-regression" } }); assert.equal(sessionRead.statusCode, 200);
    assert.deepEqual(seen.slice(-2), [
      { url: "/api/auth/session", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: undefined },
      { url: "/api/status", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: undefined }
    ]);
    const write = await runtime.app.inject({ method: "POST", url: "/api/layout", headers: { ...auth, origin: previewOrigin }, payload: {} }); assert.equal(write.statusCode, 503); assert.equal(requests, 6);
    const retiredAtlas = await runtime.app.inject({ method: "GET", url: "/api/atlas/journeys", headers: auth }); assert.equal(retiredAtlas.statusCode, 410); assert.equal(requests, 6);
  } finally { await runtime.app.close(); await new Promise<void>(resolve => upstream.close(() => resolve())); fixture.cleanup(); }
});

test("scheduled Spotify sync requires the shared secret and preserves it across the compatibility boundary", async () => {
  const scheduledSyncSecret = "test-scheduled-sync-secret-0123456789";
  let receivedToken = "";
  const upstream = http.createServer((req, res) => { receivedToken = String(req.headers["x-driveos-sync-token"] || ""); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ synced: true })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve)); const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, legacyReadOnly: false, publicOrigin: "https://journeydeck.me", scheduledSyncSecret });
  try {
    const missing = await runtime.app.inject({ method: "POST", url: "/api/spotify/sync", payload: {} }); assert.equal(missing.statusCode, 401); assert.equal(receivedToken, "");
    const wrong = await runtime.app.inject({ method: "POST", url: "/api/spotify/sync", headers: { "x-driveos-sync-token": `${scheduledSyncSecret}-wrong` }, payload: {} }); assert.equal(wrong.statusCode, 401); assert.equal(receivedToken, "");
    const valid = await runtime.app.inject({ method: "POST", url: "/api/spotify/sync", headers: { "x-driveos-sync-token": scheduledSyncSecret }, payload: {} }); assert.equal(valid.statusCode, 200); assert.equal(receivedToken, scheduledSyncSecret);
  } finally { await runtime.app.close(); await new Promise<void>(resolve => upstream.close(() => resolve())); fixture.cleanup(); }
});
