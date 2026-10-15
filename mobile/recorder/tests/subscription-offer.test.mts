import assert from 'node:assert/strict';
import test from 'node:test';

import { subscriptionOfferLine } from '../src/subscription-offer.ts';

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
