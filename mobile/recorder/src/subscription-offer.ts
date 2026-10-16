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

export type IntroPeriodUnit = 'day' | 'week' | 'month' | 'year';

/**
 * Day count for an eligible StoreKit free-trial intro offer.
 * App Store Connect's 7-day trial is a 1-week period, not a 7-day period.
 * Month and year offers are not converted into a guessed day count.
 * Ineligible, paid intros, and missing offer data return null.
 */
export function introductoryTrialDays(input: {
  paymentMode: string | null;
  periodUnit: IntroPeriodUnit | null;
  periodValue: number | null;
  periodCount: number | null;
  eligible: boolean;
}): number | null {
  if (!input.eligible || input.paymentMode !== 'freeTrial') return null;
  const value = input.periodValue;
  const count = input.periodCount;
  if (value == null || count == null || !Number.isInteger(value) || !Number.isInteger(count) || value < 1 || count < 1 || input.periodUnit == null) return null;
  const daysPerUnit = introUnitDays(input.periodUnit);
  if (daysPerUnit == null) return null;
  const days = daysPerUnit * value * count;
  if (!Number.isSafeInteger(days) || days < 1 || days > 366) return null;
  return days;
}

function introUnitDays(unit: IntroPeriodUnit): number | null {
  switch (unit) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month':
    case 'year':
      return null;
    default: {
      const unexpected: never = unit;
      return unexpected;
    }
  }
}

/**
 * Guideline 3.1.2 renewal disclosure. A missing product does not invent a price.
 */
export function subscriptionRenewalDisclosure(product: Pick<OfferProduct, 'displayPrice' | 'periodUnit' | 'periodValue'> | null): string {
  const price = product ? subscriptionPriceLabel(product) : null;
  const charge = price
    ? `Payment of ${price} is charged to your Apple Account at confirmation. The subscription renews automatically unless cancelled at least 24 hours before the period ends, and the account is charged ${price} for renewal within 24 hours prior to the end.`
    : 'Payment is charged to your Apple Account at confirmation. The subscription renews automatically unless cancelled at least 24 hours before the period ends, and the account is charged for renewal within 24 hours prior to the end.';
  return `${charge} Manage or cancel it in Settings. Any unused portion of a free trial, if offered, is forfeited when you purchase a subscription.`;
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
