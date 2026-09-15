# Public medallion collection

The public homepage at `/#medallions` includes all ten medallions and four
appearances from the latest local drop preview. Cinematic Dark is the default,
matching the existing homepage. Other appearances recolor the explorer itself.

## Source and generated assets

- `web/landing.html`: navigation link and accessible section/static fallback.
- `web/medallions/medallions.css`: responsive layout and scoped theme colors.
- `web/medallions/catalog.js`: public milestone names and descriptions.
- `web/medallions/medallions.js`: selection, lazy initialization, reveal,
  reduced motion, visibility/disposal, and fallback handling.
- `tools/public-medallions/source/`: an exact snapshot of the approved
  mobile/demo renderer and artwork frames, with a browser build entry. This
  keeps the website independently rebuildable before the mobile work reaches
  production `main`. Update the snapshot deliberately when adopting app changes.
- `web/medallions/viewer.js`: generated, self-contained Three.js browser bundle.
- `web/assets/medallions/`: 40 web delivery faces and 40 circular thumbnails.
  The original mobile artwork stays unchanged. Full faces retain 1254px size
  with WebP quality 90; thumbnails use the approved frame, a circular mask,
  480px dimensions and WebP quality 86. Combined artwork is about 16.3 MiB.

Rebuild the renderer from the repository root:

```powershell
npm ci --prefix tools/public-medallions
node tools/Build-PublicMedallions.mjs
```

To also rebuild artwork, pass the approved source directory as the first
argument (for example `mobile/recorder/assets/medallions-v2` in the app design
checkout). Original artwork is not required to rebuild the renderer. The website
release includes every prepared face and thumbnail.

This pins the demo's existing esbuild, sharp and Three.js versions in an isolated
build package; root/server/mobile dependencies do not change. Include
the generated bundle, Three.js license and artwork when releasing the website;
the hosted server needs no mobile dependencies or runtime asset build. When
changing generated content in a later release, update the public asset versions.

## Browser behavior

The renderer and selected full-size face load when the explorer enters the
viewport. Collection thumbnails load lazily. Only one current coin is displayed;
superseded asynchronous loads dispose their renderers. The completed coin drops
into view after the first 3D frame. Reduced Motion uses a brief opacity reveal
and disables inertia. Leaving the section pauses the renderer's motion.

Drag horizontally, use the left/right arrow keys, or press Home/double-click to
return to the front. Vertical touch scrolling remains available. Failed WebGL
or bundle loading shows the selected circular artwork and an explanatory status;
Replay retries initialization. Without JavaScript, the default artwork and
milestone description remain visible. This is a public collection preview and
does not read personal achievements, routes, dates, or account data.

## Verification

Use the real hosted-mode Fastify application to check the homepage and all
same-origin assets under its existing CSP. Check 1440px desktop, 768px tablet,
390px and 320px phone layouts, all 40 selections, rapid changes, keyboard/drag,
replay, reduced motion, WebGL loss/recovery, failed bundle loading and JavaScript
disabled. Existing public-route tests cover legal/login and desktop isolation.
