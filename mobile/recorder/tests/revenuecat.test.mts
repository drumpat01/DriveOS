import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createBillingObserver } from '../src/revenuecat-observer.ts';

const require = createRequire(import.meta.url);
const configureApp = require('../app.config.js');

test('billing mirror deduplicates migration, retries offline, and explicitly resyncs restores', async () => {
  let marker: string | null = null;
  let calls = 0;
  let fail = true;
  const billing = createBillingObserver({
    configure: () => true, userId: async () => 'anonymous-test',
    readMarker: async () => marker, writeMarker: async value => { marker = value; },
    sync: async () => { calls++; if (fail) throw new Error('offline'); },
  });
  await billing.sync();
  assert.equal(marker, null);
  fail = false;
  await Promise.all([billing.sync(), billing.sync()]);
  assert.equal(calls, 2);
  assert.equal(marker, 'anonymous-test');
  await billing.sync();
  assert.equal(calls, 2);
  await billing.sync(true);
  assert.equal(calls, 3);
});

test('missing or failing SDK never blocks local membership', async () => {
  for (const configure of [() => false, () => { throw new Error('unavailable'); }]) {
    const billing = createBillingObserver({ configure,
      userId: async () => { throw new Error('must not reach'); },
      sync: async () => assert.fail('must not sync'),
      readMarker: async () => null, writeMarker: async () => {},
    });
    assert.equal(billing.start(), false);
    await billing.sync(true);
  }
});

test('preview and production select separate public Apple keys and new native runtimes', () => {
  const names = ['APP_VARIANT', 'EAS_BUILD_PROFILE', 'REVENUECAT_PREVIEW_APPLE_API_KEY', 'REVENUECAT_PRODUCTION_APPLE_API_KEY'];
  const previous = names.map(name => process.env[name]);
  try {
    delete process.env.EAS_BUILD_PROFILE;
    process.env.REVENUECAT_PREVIEW_APPLE_API_KEY = 'appl_preview';
    process.env.REVENUECAT_PRODUCTION_APPLE_API_KEY = 'appl_production';
    const base = { ios: { infoPlist: {}, bundleIdentifier: 'com.journeydeck.recorder' } };
    process.env.APP_VARIANT = 'v2-preview';
    const preview = configureApp({ config: base });
    assert.equal(preview.extra.revenueCat.appleApiKey, 'appl_preview');
    assert.equal(preview.runtimeVersion, '2.0.0-preview.14');
    delete process.env.REVENUECAT_PREVIEW_APPLE_API_KEY;
    assert.equal(configureApp({ config: base }).extra.revenueCat.appleApiKey, '');
    delete process.env.APP_VARIANT;
    assert.equal(configureApp({ config: base }).extra.revenueCat.appleApiKey, 'appl_production');
    process.env.REVENUECAT_PRODUCTION_APPLE_API_KEY = 'sk_private';
    assert.throws(() => configureApp({ config: base }), /public Apple SDK key/);
  } finally {
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});
