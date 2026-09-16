# Grand Touring public homepage

The Grand Touring landing page is the canonical public homepage at `/`. Its
midnight blue, champagne gold, ivory, and evergreen colors follow the app's
Grand Touring palette. The former `/beta`, `/beta/`, `/beta.html`, and
`/landing.html` entry points redirect to `/`; private app routes remain separate.

## Content and assets

- `web/beta.html`, `beta.css`, and `beta.js` are standalone vanilla web files.
- The live download destination is
  https://apps.apple.com/us/app/journeydeck/id6806502526.
- Keep the X account at https://x.com/JourneyDeck and the Privacy, Terms,
  Support, sign-in, and Apple standard EULA links.
- JourneyDeck 2.0 was approved and manually released on September 16, 2026. The
  page presents its medallions, dedicated iPad layout, and Apple Watch companion
  as current release features.
- The carousel uses the five Grand Touring screenshots supplied by the user on
  September 15. Order: Home (Photo 5), Soundtracks (Photo 1), Memories (Photo 2),
  Medallions / Long Play (Photo 3), Statistics (Photo 4). Each has corresponding
  feature copy and alt text. The preliminary App Store captures were replaced.
- Delivery files are under `web/assets/beta/screens/`, encoded as WebP quality 95
  at their original 589×1280 dimensions. The supplied screenshots and their
  content were not cropped or recolored; original attachments remain untouched.
- Existing Grand Touring landscape artwork supplies the scenic section and
  decorative photo card. Atlas and device outlines are decorative illustrations.
- The embedded medallion explorer reuses the production controller, catalog,
  renderer, and 40 themed faces described in `docs/public-medallions.md`.
  Its initial appearance is Grand Touring (`redline`).

## Motion and accessibility

Home stays visible until a visitor changes slides or explicitly plays the tour.
Screenshot and feature copy change together after the next image decodes. Rapid
input cancels old transitions. Buttons, arrow/Home/End keys, and horizontal
swipes work; vertical touch scrolling remains native. Optional playback pauses
outside the viewport, in a hidden tab, or upon manual navigation. Reduced Motion
disables playback, flips, parallax, and scroll reveals. Core copy and the default
screenshots/medallion remain visible without JavaScript.

The page uses IntersectionObserver for reveals and lazy 3D initialization, plus
one requestAnimationFrame per scroll update. The Three.js bundle does not load
until the collection enters view. No new dependencies, analytics, server routes,
public account data, or app runtime changes are introduced. The canonical URL,
Open Graph URL, sitemap, and navigation all point to `/`.

## Verification

Public route coverage is in `server/tests/api.test.ts`; interaction and fallback
coverage is in `tests/e2e/public-beta.spec.ts`. The latter uses `/beta.html` on the
existing static mock server. Also verify `/` through real hosted-mode Fastify to
exercise the production CSP and routing, all screenshots, 3D, phone swipes,
responsive layout, and reduced-motion behavior.

Local Chromium checks cover actual mobile touch input, autoplay and manual pause,
all four medallion finishes, keyboard/drag, rapid carousel changes, 320/390/768/
1440px layouts, and no-JavaScript fallback. Windows WebKit can render a basic
document but its navigation test timed out; do not count that as Safari validation.
