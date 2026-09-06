import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { patchController } = require('../plugins/with-even-native-tabs.js');
const original = readFileSync(new URL('../node_modules/react-native-screens/ios/tabs/host/RNSTabBarController.mm', import.meta.url), 'utf8');

test('native spacing guard matches both the installed and cloud lockfile version', () => {
  const installed = require('react-native-screens/package.json').version;
  const locked = require('../package-lock.json').packages['node_modules/react-native-screens'].version;
  const plugin = readFileSync(new URL('../plugins/with-even-native-tabs.js', import.meta.url), 'utf8');
  assert.equal(installed, '4.26.2');
  assert.equal(locked, installed);
  assert.ok(plugin.includes("version !== '" + installed + "'"));
});

test('native spacing patch preserves the controller and is idempotent', () => {
  const patched = patchController(original);
  assert.equal(patchController(patched), patched);
  assert.equal(patched.split('- (void)viewDidLayoutSubviews').length, 2);
  assert.ok(patched.includes('UITabBarItemPositioningCentered'));
  assert.ok(patched.includes('/ self.tabBar.items.count'));
  for (const target of ['self.tabBar.standardAppearance', 'self.tabBar.scrollEdgeAppearance', 'item.standardAppearance', 'item.scrollEdgeAppearance']) {
    assert.ok(patched.includes('journeyDeckAppearance:' + target));
  }
  assert.ok(patched.includes('updated.stackedItemWidth = itemWidth'));
  assert.ok(patched.includes('updated.stackedItemSpacing = spacing'));
  assert.ok(patched.includes('[appearance copy]'));
  assert.ok(patched.includes('appearance == nil'));
  assert.ok(patched.includes('self.tabBar.items.count != 5'));
  assert.ok(patched.includes('UIUserInterfaceIdiomPhone'));
  assert.ok(patched.includes('<= 0.25'));
  assert.doesNotMatch(patched, /self\.tabBar\.itemWidth\s*=/);
  assert.doesNotMatch(patched.slice(patched.indexOf('// JourneyDeck:'), patched.indexOf('- (instancetype)init\n')), /selectedIndex\s*=|setViewControllers|valueForKey|method_exchangeImplementations/);
});

test('a prebuilt copy upgrades the earlier patch without duplicating layout callbacks', () => {
  const legacy = original.replace('- (instancetype)init\n', '// JourneyDeck: equal native tab slots\n- (void)viewDidLayoutSubviews { /* previous patch */ }\n\n- (instancetype)init\n');
  const updated = patchController(legacy);
  assert.ok(updated.includes('equal native tab appearance slots v2'));
  assert.equal(updated.split('- (void)viewDidLayoutSubviews').length, 2);
  assert.equal(patchController(updated), updated);
});

test('dependency changes fail closed instead of patching an unknown controller', () => {
  assert.throws(() => patchController('unrecognized source'), /Review/);
  assert.throws(() => patchController('- (void)viewDidLayoutSubviews {}\n- (instancetype)init\n'), /Review/);
});
