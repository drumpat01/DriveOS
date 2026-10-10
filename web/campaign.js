const APP_STORE_HOSTS = new Set(['apps.apple.com', 'www.apps.apple.com']);

export const UTM_SOURCE_STORAGE_KEY = 'journeydeck:utm_source';
export const UTM_CAMPAIGN_STORAGE_KEY = 'journeydeck:utm_campaign';

// Apple only attributes App Store campaigns when pt is set.
// Patrick will supply this provider token from App Store Connect.
export const APP_STORE_PROVIDER_TOKEN = '';

// Shown on the home hero when the visitor arrived from X. The HTML default stays in place for crawlers and no-JS users.
export const X_HEADLINE_VARIANT = 'Keep the drive.<br><span class="gold">Keep the song.</span>';

export function sanitizeCampaignToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function buildAppleCampaignToken(source, campaign) {
  return sanitizeCampaignToken([sanitizeCampaignToken(source), sanitizeCampaignToken(campaign)].filter(Boolean).join('-'));
}

export function isAppStoreHref(href, base = 'https://journeydeck.me') {
  try {
    const url = new URL(String(href || ''), base);
    return url.protocol === 'https:' && APP_STORE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function rewriteAppStoreHref(href, source, campaign, providerToken = APP_STORE_PROVIDER_TOKEN) {
  const token = buildAppleCampaignToken(source, campaign);
  if (!token || !isAppStoreHref(href)) return href;
  let url;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  url.searchParams.set('ct', token);
  const provider = String(providerToken || '').trim();
  if (provider) url.searchParams.set('pt', provider);
  return url.toString();
}

export function readCampaignFromLanding(searchParams, storage) {
  const hasSource = searchParams.has('utm_source');
  const hasCampaign = searchParams.has('utm_campaign');
  if (hasSource || hasCampaign) {
    const source = hasSource ? String(searchParams.get('utm_source') || '') : '';
    const campaign = hasCampaign ? String(searchParams.get('utm_campaign') || '') : '';
    writeCampaign(storage, source, campaign);
    return { source, campaign };
  }
  return {
    source: readStorage(storage, UTM_SOURCE_STORAGE_KEY),
    campaign: readStorage(storage, UTM_CAMPAIGN_STORAGE_KEY)
  };
}

export function applyAppStoreCampaigns(root, source, campaign, providerToken = APP_STORE_PROVIDER_TOKEN) {
  for (const anchor of root.querySelectorAll('a[href]')) {
    const current = anchor.getAttribute('href');
    if (!current) continue;
    const next = rewriteAppStoreHref(current, source, campaign, providerToken);
    if (next !== current) anchor.setAttribute('href', next);
  }
}

export function applyHomeHeadlineVariant(root, source) {
  if (String(source || '').toLowerCase() !== 'x') return;
  const title = root.querySelector('#hero-title');
  if (title) title.innerHTML = X_HEADLINE_VARIANT;
}

export function initPublicCampaign(windowLike, documentLike = windowLike?.document) {
  if (!documentLike || !windowLike?.location) return;
  const campaign = readCampaignFromLanding(new URLSearchParams(windowLike.location.search || ''), windowLike.sessionStorage);
  applyAppStoreCampaigns(documentLike, campaign.source, campaign.campaign, APP_STORE_PROVIDER_TOKEN);
  applyHomeHeadlineVariant(documentLike, campaign.source);
  documentLike.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || !isAppStoreHref(anchor.getAttribute('href') || anchor.href)) return;
    windowLike.dispatchEvent(new CustomEvent('journeydeck:appstore-click', {
      detail: {
        page: windowLike.location.pathname || '',
        source: campaign.source,
        campaign: campaign.campaign,
        href: anchor.href
      }
    }));
  });
}

function readStorage(storage, key) {
  try {
    return storage?.getItem?.(key) || '';
  } catch {
    return '';
  }
}

function writeCampaign(storage, source, campaign) {
  try {
    storage?.setItem?.(UTM_SOURCE_STORAGE_KEY, source);
    storage?.setItem?.(UTM_CAMPAIGN_STORAGE_KEY, campaign);
  } catch {
    // sessionStorage can be blocked; campaign params still apply on this page.
  }
}

if (typeof document !== 'undefined') initPublicCampaign(window, document);
