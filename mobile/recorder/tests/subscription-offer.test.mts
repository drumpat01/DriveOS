import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { introductoryTrialDays, subscriptionOfferLine, subscriptionRenewalDisclosure } from '../src/subscription-offer.ts';

const annual = {
  displayPrice: '$39.99',
  periodUnit: 'year' as const,
  periodValue: 1,
  introTrialDays: 7,
};

test('an eligible intro offer uses the StoreKit trial length and price', () => {
  assert.equal(subscriptionOfferLine(annual), '7 days free, then $39.99/year. Cancel anytime.');
  assert.equal(subscriptionOfferLine({ ...annual, introTrialDays: 1, displayPrice: '€39.99' }), '1 day free, then €39.99/year. Cancel anytime.');
});

test('a member who is not eligible for the intro offer sees the regular price and no trial', () => {
  assert.equal(subscriptionOfferLine({ ...annual, introTrialDays: null }), '$39.99/year. Cancel anytime.');
  assert.equal(subscriptionOfferLine({ ...annual, introTrialDays: 0 }), '$39.99/year. Cancel anytime.');
});

test('a missing price does not invent one', () => {
  assert.equal(subscriptionOfferLine({ ...annual, displayPrice: '  ' }), 'Cancel anytime.');
});

test('a 7-day trial is the StoreKit one-week intro, and ineligible or non-day offers do not invent one', () => {
  const week = { paymentMode: 'freeTrial', periodUnit: 'week' as const, periodValue: 1, periodCount: 1, eligible: true };
  assert.equal(introductoryTrialDays(week), 7);
  assert.equal(introductoryTrialDays({ ...week, periodUnit: 'day', periodValue: 3 }), 3);
  assert.equal(introductoryTrialDays({ ...week, periodUnit: 'day', periodValue: 1, periodCount: 7 }), 7);
  assert.equal(introductoryTrialDays({ ...week, eligible: false }), null);
  assert.equal(introductoryTrialDays({ ...week, paymentMode: 'payAsYouGo' }), null);
  assert.equal(introductoryTrialDays({ ...week, periodUnit: 'month' }), null);
  assert.equal(introductoryTrialDays({ ...week, periodValue: null }), null);
  const swift = readFileSync(new URL('../modules/journeydeck-membership/ios/JourneyDeckMembershipModule.swift', import.meta.url), 'utf8');
  assert.match(swift, /case \.week:\s*daysPerUnit = 7/);
  assert.match(swift, /periodCount: offer\.periodCount/);
  assert.match(swift, /eligible: await subscription\.isEligibleForIntroOffer/);
});

test('the paywall states price, period, auto-renew, and trial forfeiture without a Weekly plan', () => {
  const disclosure = subscriptionRenewalDisclosure(annual);
  assert.match(disclosure, /\$39\.99\/year/);
  assert.match(disclosure, /renews automatically/i);
  assert.match(disclosure, /24 hours before the period ends/);
  assert.match(disclosure, /within 24 hours prior to the end/);
  assert.match(disclosure, /free trial, if offered, is forfeited/);
  assert.doesNotMatch(disclosure, /weekly/i);
  const offline = subscriptionRenewalDisclosure(null);
  assert.doesNotMatch(offline, /\$39\.99/);
  assert.match(offline, /renews automatically/i);
  const products = readFileSync(new URL('../modules/journeydeck-membership/index.ts', import.meta.url), 'utf8');
  const v4Start = products.indexOf('JOURNEYDECK_V4_MEMBERSHIP_PRODUCT_IDS');
  const v4 = products.slice(v4Start, products.indexOf('] as const;', v4Start));
  assert.match(v4, /ANNUAL/);
  assert.doesNotMatch(v4, /weekly/);
  const paywall = readFileSync(new URL('../src/membership-paywall-v4.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(paywall, /Weekly/);
  assert.match(paywall, /journeydeck\.me\/privacy/);
  assert.match(paywall, /stdeula/);
  assert.match(paywall, /Restore Purchases/);
});
