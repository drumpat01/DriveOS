import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as entitlements from '../src/membership-entitlements.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const free = { nativeModuleAvailable: true, tier: 'free', activeProductId: null, expirationDate: null, environment: null };
const paid = { ...free, tier: 'paid', activeProductId: 'com.journeydeck.recorder.pro.monthly', expirationDate: '2099-10-01T00:00:00Z', environment: 'sandbox' };

test('the V2 preview Atlas override changes only Atlas access', () => {
  const ordinaryFree = entitlements.entitlementsForMembershipTier('free');
  const previewFree = entitlements.withPreviewAtlasAccess(ordinaryFree, true);
  assert.deepEqual(previewFree, { ...ordinaryFree, atlasAccess: true });
  assert.equal(previewFree.tier, 'free');
  assert.equal(previewFree.timelineHistoryDays, 45);
  assert.equal(previewFree.tessieAccess, false);
  assert.strictEqual(entitlements.withPreviewAtlasAccess(ordinaryFree, false), ordinaryFree);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function harness(overrides: Record<string, any> = {}) {
  let control: any, tree: any, listener: any, appStateListener: any;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextTimer = 0;
  const mocks = {
    'react-native': { AppState: { addEventListener: (_event: string, handler: any) => { appStateListener = handler; return { remove() { appStateListener = null; } }; } } },
    './membership-entitlements': entitlements,
    './release-features': { V2_PREVIEW_ATLAS_UNLOCKED: false },
    '../modules/journeydeck-membership': {
      isJourneyDeckMembershipNativeAvailable: true,
      getMembershipStatus: async () => free,
      getMembershipProducts: async () => [],
      purchaseMembership: async () => ({ outcome: 'purchased', status: paid }),
      restoreMembershipPurchases: async () => paid,
      ...overrides,
      addMembershipChangeListener: (handler: any) => { listener = handler; return { remove() { listener = null; } }; },
    },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../src/membership-store.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const addTimer = (callback: () => void, delay: number) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; };
  vm.runInNewContext(code, {
    module, exports: module.exports, Error, Date,
    setInterval: addTimer, clearInterval: (id: number) => timers.delete(id),
    setTimeout: addTimer, clearTimeout: (id: number) => timers.delete(id),
    require: (id: string) => mocks[id] ?? require(id),
  });
  function Content() { control = module.exports.useJourneyDeckMembership(); return null; }
  await act(async () => { tree = create(React.createElement(Content)); });
  return {
    get control() { return control; }, timers,
    emit: async (status: any) => { await act(async () => { listener(status); }); },
    foreground: async () => { await act(async () => { appStateListener('active'); }); },
    dispose: async () => { await act(async () => { tree.unmount(); }); assert.equal(listener, null); assert.equal(appStateListener, null); assert.equal(timers.size, 0); },
  };
}

test('an older startup read cannot undo an approved transaction event', async () => {
  const initial = deferred<any>();
  const h = await harness({ getMembershipStatus: () => initial.promise });
  try {
    await h.emit(paid);
    assert.equal(h.control.state.entitlements.tier, 'paid');
    await act(async () => { initial.resolve(free); await initial.promise; });
    assert.equal(h.control.state.entitlements.tier, 'paid', 'stale startup free status must not hide purchased history');
  } finally { await h.dispose(); }
});

test('a late old refresh error cannot erase a newer restored entitlement', async () => {
  const initial = deferred<any>();
  const h = await harness({ getMembershipStatus: () => initial.promise });
  try {
    await act(async () => { await h.control.restore(); });
    assert.equal(h.control.state.entitlements.tier, 'paid');
    await act(async () => { initial.reject(new Error('old bridge read failed')); await initial.promise.catch(() => {}); });
    assert.equal(h.control.state.entitlements.tier, 'paid');
    assert.equal(h.control.state.phase, 'ready');
  } finally { await h.dispose(); }
});

test('the latest verification wins when foreground reads complete in reverse order', async () => {
  const old = deferred<any>(), latest = deferred<any>();
  let reads = 0;
  const h = await harness({ getMembershipStatus: () => ++reads === 1 ? old.promise : latest.promise });
  try {
    await h.foreground();
    await act(async () => { latest.resolve(free); await latest.promise; });
    await act(async () => { old.resolve(paid); await old.promise; });
    assert.equal(h.control.state.entitlements.tier, 'free', 'a stale paid read must not undo a newer expiration/refund');
  } finally { await h.dispose(); }
});

test('pending approval, duplicate taps and restore do not invent paid access', async () => {
  const purchase = deferred<any>();
  let purchases = 0, restores = 0;
  const h = await harness({
    purchaseMembership: () => { purchases++; return purchase.promise; },
    restoreMembershipPurchases: async () => { restores++; return free; },
  });
  try {
    let first: Promise<any>;
    await act(async () => {
      first = h.control.purchase(paid.activeProductId);
      assert.equal(await h.control.purchase(paid.activeProductId), 'pending');
      await h.control.restore();
    });
    assert.equal(purchases, 1); assert.equal(restores, 0);
    assert.equal(h.control.state.purchasePending, true);
    await act(async () => { purchase.resolve({ outcome: 'pending', status: free }); assert.equal(await first!, 'pending'); });
    assert.equal(h.control.state.entitlements.tier, 'free');
    assert.match(h.control.state.message, /awaiting approval/);
    await h.emit(paid);
    assert.equal(h.control.state.entitlements.tier, 'paid');
    await act(async () => { await h.control.restore(); });
    assert.equal(h.control.state.entitlements.tier, 'free');
    assert.match(h.control.state.message, /No active/);
  } finally { await h.dispose(); }
});

test('a transaction change during purchase is not overwritten by its delayed response', async () => {
  const purchase = deferred<any>();
  let reads = 0;
  const h = await harness({ getMembershipStatus: async () => { reads++; return free; }, purchaseMembership: () => purchase.promise });
  try {
    let result: Promise<any>;
    await act(async () => { result = h.control.purchase(paid.activeProductId); });
    await h.foreground();
    assert.equal(reads, 1, 'App Store sheet foregrounding must not start a competing refresh');
    await h.emit(paid);
    await act(async () => { purchase.resolve({ outcome: 'cancelled', status: free }); assert.equal(await result!, 'cancelled'); });
    assert.equal(h.control.state.entitlements.tier, 'paid');
    assert.equal(h.control.state.message, null);
  } finally { await h.dispose(); }
});

test('a completed purchase without an active entitlement does not dismiss the paywall as unlocked', async () => {
  const h = await harness({ purchaseMembership: async () => ({ outcome: 'purchased', status: free }) });
  try {
    await act(async () => { assert.equal(await h.control.purchase(paid.activeProductId), 'pending'); });
    assert.equal(h.control.state.entitlements.tier, 'free');
    assert.equal(h.control.state.purchasePending, false);
    assert.match(h.control.state.message, /completed the purchase.*Restore Purchases/);
  } finally { await h.dispose(); }
});

test('cancellation and failed restore preserve the last verified membership', async () => {
  const h = await harness({
    getMembershipStatus: async () => paid,
    purchaseMembership: async () => ({ outcome: 'cancelled', status: paid }),
    restoreMembershipPurchases: async () => { throw new Error('App Store is offline'); },
  });
  try {
    await act(async () => { assert.equal(await h.control.purchase(paid.activeProductId), 'cancelled'); });
    assert.equal(h.control.state.entitlements.tier, 'paid');
    assert.equal(h.control.state.message, null);
    await act(async () => { await h.control.restore(); });
    assert.equal(h.control.state.entitlements.tier, 'paid');
    assert.equal(h.control.state.purchasePending, false);
    assert.match(h.control.state.message, /offline/);
  } finally { await h.dispose(); }
});

test('renewal boundary rechecks StoreKit and honors a verified billing grace period', async () => {
  let nextStatus: any = { ...paid, expirationDate: new Date(Date.now() + 30_000).toISOString() };
  const h = await harness({ getMembershipStatus: async () => nextStatus });
  try {
    const expiryTimer = [...h.timers.values()].find(timer => timer.delay < 60_000);
    assert.ok(expiryTimer, 'membership must recheck near known expiration instead of waiting fifteen minutes');
    nextStatus = { ...paid, expirationDate: '2020-01-01T00:00:00Z' };
    await act(async () => { expiryTimer.callback(); });
    assert.equal(h.control.state.entitlements.tier, 'paid', 'StoreKit currentEntitlements remains authoritative during billing grace');
    nextStatus = free;
    await h.foreground();
    assert.equal(h.control.state.entitlements.tier, 'free', 'a verified expiration removes access');
  } finally { await h.dispose(); }
});

test('missing native membership module fails closed and does not load products', async () => {
  let productRequests = 0;
  const h = await harness({
    isJourneyDeckMembershipNativeAvailable: false,
    getMembershipStatus: async () => ({ ...free, nativeModuleAvailable: false }),
    getMembershipProducts: async () => { productRequests++; return []; },
  });
  try {
    await act(async () => { assert.equal(await h.control.loadProducts(), false); });
    assert.equal(h.control.state.entitlements.tier, 'free');
    assert.equal(productRequests, 0);
    assert.equal(h.control.state.productsLoading, false);
  } finally { await h.dispose(); }
});

test('product reloads clear stale prices and ignore superseded responses', async () => {
  const old = deferred<any>(), latest = deferred<any>();
  let loads = 0;
  const h = await harness({ getMembershipProducts: () => ++loads === 1 ? old.promise : latest.promise });
  try {
    let first: Promise<any>, second: Promise<any>;
    await act(async () => { first = h.control.loadProducts(); second = h.control.loadProducts(); });
    await act(async () => { latest.resolve([{ id: paid.activeProductId, displayPrice: 'new' }]); await second!; });
    await act(async () => { old.resolve([{ id: paid.activeProductId, displayPrice: 'old' }]); assert.equal(await first!, false); });
    assert.equal(h.control.state.products[0].displayPrice, 'new');
    assert.equal(h.control.state.productsLoading, false);
  } finally { await h.dispose(); }
});
