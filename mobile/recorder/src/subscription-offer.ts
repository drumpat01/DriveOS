import type { JourneyDeckMembershipProduct } from '../modules/journeydeck-membership/src/JourneyDeckMembership.types';

type OfferProduct = Pick<JourneyDeckMembershipProduct, 'displayPrice' | 'periodUnit' | 'periodValue' | 'introTrialDays'>;

/** Localized StoreKit price plus the subscription period, such as `$39.99/year`. */
export function subscriptionPriceLabel(product: Pick<OfferProduct, 'displayPrice' | 'periodUnit' | 'periodValue'>): string | null {
  const price = product.displayPrice.trim();
  if (!price) return null;
  if (!product.periodUnit || product.periodValue == null || product.periodValue < 1) return price;
  const unit = product.periodValue === 1 ? product.periodUnit : `${product.periodUnit}s`;
  const span = product.periodValue === 1 ? unit : `${product.periodValue} ${unit}`;
  return `${price}/${span}`;
}

/**
 * Purchase sentence from the StoreKit product and its eligible intro offer.
 * No trial length or price is invented here. When Apple reports no eligible
 * free-trial intro, the sentence is the regular price only.
 */
export function subscriptionOfferLine(product: OfferProduct): string {
  const price = subscriptionPriceLabel(product);
  if (!price) return 'Cancel anytime.';
  const trialDays = product.introTrialDays;
  if (trialDays != null && trialDays > 0) {
    return `${trialDays} ${trialDays === 1 ? 'day' : 'days'} free, then ${price}. Cancel anytime.`;
  }
  return `${price}. Cancel anytime.`;
}
