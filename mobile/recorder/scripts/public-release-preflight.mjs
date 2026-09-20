import { readFile } from 'node:fs/promises';

const privacyUrl = process.env.JOURNEYDECK_APP_STORE_PRIVACY_URL || '';
const supportUrl = process.env.JOURNEYDECK_APP_STORE_SUPPORT_URL || '';
const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');

const failures = [];

function fail(message) {
  failures.push(message);
}

function publicHttpsUrl(name, value) {
  if (!value) {
    fail(`${name} is not set. Set its JOURNEYDECK_APP_STORE_*_URL environment variable before running this check.`);
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') fail(`${name} must use HTTPS.`);
    if (url.username || url.password || url.search || url.hash) fail(`${name} must not include credentials, a query, or a fragment.`);
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.ts.net')) fail(`${name} must be publicly reachable, not a local or tailnet address.`);
    return url;
  } catch {
    fail(`${name} is not a valid absolute URL.`);
    return null;
  }
}

async function verifyPage(name, configuredUrl, requiredText, needsContact) {
  const url = publicHttpsUrl(name, configuredUrl);
  if (!url) return;
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'JourneyDeck-AppStore-Preflight/1.0' },
    });
    if (response.status < 200 || response.status >= 300) {
      fail(`${name} returned HTTP ${response.status}; it must return a public 2xx response without an authentication redirect.`);
      return;
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) fail(`${name} must return an HTML page.`);
    const body = (await response.text()).slice(0, 250_000);
    if (!requiredText.test(body)) fail(`${name} does not contain the expected policy/support content.`);
    if (/\{[A-Z_]+\}/.test(body)) fail(`${name} still contains an unresolved publication placeholder.`);
    if (needsContact && !/(mailto:|<form\b)/i.test(body)) fail(`${name} needs a clear email link or contact form.`);
  } catch (error) {
    fail(`${name} could not be fetched: ${error instanceof Error ? error.message : 'unknown network error'}`);
  }
}

if (eas.build.production.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING !== '0') fail('eas.json must disable internal testing for the production build.');
if (app.expo.extra.edge.url !== 'https://journeydeck-edge.patrickbstewart.workers.dev') fail('app.json must point at the documented production privacy edge.');
if (/preview/i.test(app.expo.extra.edge.url)) fail('app.json must not point at a preview privacy edge.');
if (/JourneyDeck Pro|PRO MEMBERSHIP|\$4\.99/.test(shell)) fail('Public Settings still advertises a paid tier that is not implemented.');

await verifyPage('Privacy Policy URL', privacyUrl, /privacy|personal data|location/i, true);
await verifyPage('Support URL', supportUrl, /support|help|contact/i, true);

if (failures.length) {
  console.error('Public release preflight failed:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log('Public release preflight passed.');
}
