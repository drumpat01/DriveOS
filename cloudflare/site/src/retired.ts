import { jsonResponse } from "./headers.ts";

export const RETIRED_API_BODY = {
  error: "gone",
  message: "This API has been retired."
} as const;

// Same App Store URL the public pages use for ct=site.
export const APP_STORE_URL = "https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=site&mt=8";

export function retiredApiResponse() {
  return jsonResponse(410, RETIRED_API_BODY, { "cache-control": "no-store" });
}

export function retiredPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#081832">
  <meta name="robots" content="noindex">
  <meta name="description" content="The old JourneyDeck web app has been retired. The iPhone app is still available on the App Store.">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png?v=app-logo-1">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon.png?v=app-logo-1">
  <link rel="apple-touch-icon" href="/assets/journeydeck-cinematic-180.png">
  <link rel="stylesheet" href="/public-page.css?v=perf-1">
  <link rel="stylesheet" href="/public-a11y.css?v=3">
  <title>The old web app has been retired · JourneyDeck</title>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="JourneyDeck home"><img src="/assets/beta/journeydeck-pulse.svg?v=1" width="36" height="36" alt=""><span>Journey<span class="gold">Deck</span></span></a>
    <div class="header-actions"><a class="button button-small" href="${APP_STORE_URL}">Get the app <span aria-hidden="true">↗</span></a></div>
  </header>
  <main id="main" class="page error-page">
    <section class="hero error-hero">
      <p class="eyebrow">JourneyDeck</p>
      <h1>The old web app has been retired.</h1>
      <p class="lede">The iPhone app is where JourneyDeck lives now.</p>
      <div class="page-actions">
        <a class="contact" href="${APP_STORE_URL}">Download on the App Store ↗</a>
        <a class="secondary-action" href="/">Home</a>
      </div>
    </section>
  </main>
</body>
</html>
`;
}

export function retiredPageResponse(request: Request) {
  const body = request.method === "HEAD" ? null : retiredPageHtml();
  return new Response(body, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex"
    }
  });
}
