const current = document.currentScript;
const websiteId = current && current.dataset.websiteId;
const domains = current && current.dataset.domains;
const src = current && current.dataset.umamiSrc;

for (const link of document.querySelectorAll('link[data-defer-css]')) link.media = 'all';

function loadUmami() {
  if (!src || !websiteId || document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  script.async = false;
  script.dataset.websiteId = websiteId;
  script.dataset.domains = domains || '';
  document.head.appendChild(script);
}

function scheduleUmami() {
  if ('requestIdleCallback' in window) requestIdleCallback(loadUmami, { timeout: 1500 });
  else setTimeout(loadUmami, 1);
}

if (document.readyState === 'complete') scheduleUmami();
else window.addEventListener('load', scheduleUmami, { once: true });
