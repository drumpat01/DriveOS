import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { createInstaller } = require('../scripts/serve-ios-install.cjs');

test('temporary installer serves only its token-scoped page, valid manifest and IPA ranges', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'journeydeck-installer-test-'));
  const config = { token: 'a'.repeat(48), ipa: join(folder, 'test.ipa'), originFile: join(folder, 'origin.txt'), version: '3.0.0', build: '100003' };
  writeFileSync(config.ipa, Buffer.from('synthetic installer bytes')); writeFileSync(config.originFile, 'https://test-only.trycloudflare.com');
  const server = createInstaller(config); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/')).status, 404);
    assert.equal((await fetch(base + '/' + config.token + '/settings.json')).status, 404);
    assert.equal((await fetch(base + '/' + config.token, { method: 'POST' })).status, 405);
    const page = await fetch(base + '/' + config.token); assert.match(await page.text(), /itms-services:/); assert.equal(page.headers.get('cache-control'), 'no-store');
    const manifest = await (await fetch(base + '/' + config.token + '/manifest.plist')).text();
    assert.match(manifest, /com.journeydeck.recorder.v3/); assert.match(manifest, /bundle-version<\/key><string>100003/);
    assert.match(manifest, new RegExp(config.token + '/JourneyDeckV3.ipa'));
    const range = await fetch(base + '/' + config.token + '/JourneyDeckV3.ipa', { headers: { Range: 'bytes=0-8' } });
    assert.equal(range.status, 206); assert.equal(await range.text(), 'synthetic');
    assert.equal((await fetch(base + '/' + config.token + '/JourneyDeckV3.ipa', { headers: { Range: 'bytes=500-' } })).status, 416);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); rmSync(folder, { recursive: true }); }
});
