import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

import { FREE_COMPLETED_DRIVES, shouldShowTripSummaryPaywall } from '../src/completed-drive-count.ts';
import {
  eligibleIntroTrialDays,
  FIRST_TRIP_PROMPT_PREFERENCE_KEY,
  firstTripPromptCopy,
  firstTripPromptReadyToPresent,
  firstTripPromptWasRecorded,
  shouldShowFirstTripPrompt,
  type FirstTripPromptInput,
} from '../src/first-trip-prompt.ts';

const require = createRequire(import.meta.url);

const ready: FirstTripPromptInput = {
  enabled: true,
  previousCount: 0,
  nextCount: 1,
  counted: true,
  tier: 'free',
  plusUnlocked: false,
  alreadyShown: false,
  demo: false,
};

const settled = {
  recording: false,
  finishing: false,
  saving: false,
  completionVisible: false,
  otherSheetVisible: false,
};

test('drives 1 to 3 stay free and the trip summary paywall still starts after drive 3', () => {
  assert.equal(FREE_COMPLETED_DRIVES, 3);
  assert.equal(shouldShowTripSummaryPaywall(1, false), false);
  assert.equal(shouldShowTripSummaryPaywall(3, false), false);
  assert.equal(shouldShowTripSummaryPaywall(4, false), true);
  assert.equal(shouldShowTripSummaryPaywall(4, true), false);
});

test('the first trip prompt stays off unless the flag is on and this completion is the first counted drive', () => {
  assert.equal(shouldShowFirstTripPrompt(ready), true);
  assert.equal(shouldShowFirstTripPrompt({ ...ready, enabled: false }), false, 'flag off');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, previousCount: 1, nextCount: 2 }), false, 'second trip');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, counted: false }), false, 'uncounted finish');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, previousCount: 1, nextCount: 1, counted: false }), false, 'duplicate session');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, tier: 'paid' }), false, 'subscriber');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, tier: 'paid' }), false, 'a free trial counts as paid');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, plusUnlocked: true }), false, 'TestFlight Plus unlock');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, alreadyShown: true }), false, 'already shown');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, demo: true }), false, 'demo profile');
  assert.equal(shouldShowFirstTripPrompt({ ...ready, previousCount: 0, nextCount: 1, counted: false }), false);
  assert.equal(shouldShowFirstTripPrompt({ ...ready, previousCount: 2, nextCount: 3 }), false);
});

test('the prompt waits until recording, saving, the completion moment, and other sheets are gone', () => {
  assert.equal(firstTripPromptReadyToPresent(settled), true);
  assert.equal(firstTripPromptReadyToPresent({ ...settled, recording: true }), false);
  assert.equal(firstTripPromptReadyToPresent({ ...settled, finishing: true }), false);
  assert.equal(firstTripPromptReadyToPresent({ ...settled, saving: true }), false);
  assert.equal(firstTripPromptReadyToPresent({ ...settled, completionVisible: true }), false);
  assert.equal(firstTripPromptReadyToPresent({ ...settled, otherSheetVisible: true }), false);
});

test('trial copy uses StoreKit intro days and skips the trial when the user is not eligible', () => {
  const trial = firstTripPromptCopy(7);
  assert.equal(trial.kicker, 'FIRST TRIP SAVED');
  assert.equal(trial.title, "Nice drive. That one’s saved.");
  assert.equal(trial.body, "Your first 3 trips get everything in Plus, this one included. Want to keep the Atlas, complete history and Ask JourneyDeck after that? Plus starts with a 7-day free trial whenever you’re ready.");
  assert.equal(trial.title.includes('\u2019'), true);
  assert.equal(trial.body.includes('\u2019'), true);
  assert.equal(trial.title.includes("'"), false);
  assert.equal(trial.body.includes("'"), false);
  assert.equal(trial.primary, 'See Plus');
  assert.equal(trial.secondary, 'Not now');
  assert.equal(firstTripPromptCopy(1).body, "Your first 3 trips get everything in Plus, this one included. Want to keep the Atlas, complete history and Ask JourneyDeck after that? Plus starts with a 1-day free trial whenever you’re ready.");
  const ineligible = firstTripPromptCopy(null);
  assert.equal(ineligible.title, trial.title);
  assert.equal(ineligible.body, 'Your first 3 trips get everything in Plus, this one included. Plus keeps the Atlas, complete history and Ask JourneyDeck going after that.');
  assert.equal(firstTripPromptCopy(0).body, ineligible.body);
  assert.doesNotMatch(ineligible.body, /trial/i);
  for (const copy of [trial, firstTripPromptCopy(1), ineligible]) {
    for (const value of Object.values(copy)) {
      assert.equal(value.includes('\u2013'), false);
      assert.equal(value.includes('\u2014'), false);
      assert.equal(/unlock/i.test(value), false);
      assert.equal(value.includes('$'), false);
    }
  }
});

test('intro trial days come from loaded StoreKit products only', () => {
  assert.equal(eligibleIntroTrialDays(null), null);
  assert.equal(eligibleIntroTrialDays([]), null);
  assert.equal(eligibleIntroTrialDays([{ introTrialDays: null }, { introTrialDays: 0 }]), null);
  assert.equal(eligibleIntroTrialDays([{ introTrialDays: 7 }]), 7);
  assert.equal(eligibleIntroTrialDays([{ introTrialDays: 7 }, { introTrialDays: 14 }]), 14);
  assert.equal(eligibleIntroTrialDays([{ introTrialDays: 1.5 }]), null);
});

test('the shown marker is a per profile private preference', () => {
  assert.equal(firstTripPromptWasRecorded(null), false);
  assert.equal(firstTripPromptWasRecorded({ shown: false }), false);
  assert.equal(firstTripPromptWasRecorded({ shown: true }), true);
  assert.equal(FIRST_TRIP_PROMPT_PREFERENCE_KEY, 'membership.first-trip-prompt.v1');

  const stored = new Map<string, unknown>();
  const source = readFileSync(new URL('../src/first-trip-prompt-store.ts', import.meta.url), 'utf8');
  const module = { exports: {} as {
    firstTripPromptWasShown: (userId?: string) => boolean;
    markFirstTripPromptShown: (userId?: string) => void;
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module,
    exports: module.exports,
    require: (name: string) => {
      if (name === './auth') return { getCurrentUser: () => ({ id: 'driver-1' }) };
      if (name === './first-trip-prompt') return { FIRST_TRIP_PROMPT_PREFERENCE_KEY, firstTripPromptWasRecorded };
      if (name === './local-store') return {
        getPrivatePreference: (userId: string, key: string) => stored.get(`${userId}:${key}`) ?? null,
        upsertPrivatePreference: (userId: string, key: string, value: unknown) => { stored.set(`${userId}:${key}`, value); },
      };
      return require(name);
    },
  });
  assert.equal(module.exports.firstTripPromptWasShown(), false);
  module.exports.markFirstTripPromptShown();
  assert.equal(module.exports.firstTripPromptWasShown(), true);
  assert.equal(module.exports.firstTripPromptWasShown('driver-2'), false, 'another profile has not seen it');
  assert.equal(JSON.stringify(stored.get('driver-1:membership.first-trip-prompt.v1')), '{"shown":true}');
  module.exports.markFirstTripPromptShown('driver-2');
  assert.equal(JSON.stringify(stored.get('driver-2:membership.first-trip-prompt.v1')), '{"shown":true}');
});

test('the feature flag defaults off in every variant and turns on only for JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on', () => {
  const configure = require('../app.config.js') as (input: { config: Record<string, unknown> }) => {
    extra: { features: { postFirstTripPlusPrompt: boolean } };
  };
  const base = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const previousPrompt = process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT;
  const previousVariant = process.env.APP_VARIANT;
  const previousProfile = process.env.EAS_BUILD_PROFILE;
  const previousPaywall = process.env.JOURNEYDECK_PAYWALL;
  try {
    delete process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT;
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.JOURNEYDECK_PAYWALL;
    for (const variant of [undefined, 'v2-preview', 'v3-store', 'v3-preview', 'v4-store'] as const) {
      if (variant === undefined) delete process.env.APP_VARIANT;
      else process.env.APP_VARIANT = variant;
      assert.equal(configure({ config: base }).extra.features.postFirstTripPlusPrompt, false, variant ?? 'default');
    }
    process.env.APP_VARIANT = 'v4-store';
    process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT = 'on';
    assert.equal(configure({ config: base }).extra.features.postFirstTripPlusPrompt, true);
    process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT = 'ON';
    assert.equal(configure({ config: base }).extra.features.postFirstTripPlusPrompt, false);
    process.env.JOURNEYDECK_PAYWALL = 'open';
    process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT = 'on';
    assert.equal(configure({ config: base }).extra.features.postFirstTripPlusPrompt, true, 'the prompt flag is independent of the paywall unlock');
  } finally {
    if (previousPrompt === undefined) delete process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT;
    else process.env.JOURNEYDECK_POST_FIRST_TRIP_PROMPT = previousPrompt;
    if (previousVariant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previousVariant;
    if (previousProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = previousProfile;
    if (previousPaywall === undefined) delete process.env.JOURNEYDECK_PAYWALL;
    else process.env.JOURNEYDECK_PAYWALL = previousPaywall;
  }
});

test('the shell shows the card once, opens the existing paywall, and the recorder waits for a settled trip', () => {
  const shell = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/first-trip-prompt-card.tsx', import.meta.url), 'utf8');
  const prompt = readFileSync(new URL('../src/first-trip-prompt.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../src/first-trip-prompt-store.ts', import.meta.url), 'utf8');
  assert.match(shell, /paywall\.first_trip_prompt_shown/);
  assert.match(shell, /paywall\.first_trip_prompt_tapped/);
  assert.match(shell, /paywall\.first_trip_prompt_dismissed/);
  assert.match(shell, /markFirstTripPromptShown\(\)/);
  assert.match(shell, /openPlusFromFirstTrip/);
  assert.match(shell, /onRecorderIdle=\{setRecorderIdle\}/);
  assert.match(app, /firstTripPromptReadyToPresent/);
  assert.match(card, /copy\.primary/);
  assert.match(card, /accessibilityLabel="Close"/);
  assert.match(card, /accessible=\{false\}/);
  assert.match(card, /maxFontSizeMultiplier=\{1\.4\}/);
  assert.doesNotMatch(card, /accessibilityLabel="Not now"/);
  assert.doesNotMatch(`${card}\n${prompt}\n${store}`, /\u2013|\u2014/);
});
