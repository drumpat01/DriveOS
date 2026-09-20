# JourneyDeck Duo Layout Lab

A private browser-based visual prototype for exploring JourneyDeck on a hypothetical folding iPhone Duo. It renders a two-panel device in Three.js, supports continuous hinge angles and orbit controls, and places existing JourneyDeck screenshots on the displays.

This is not an iOS simulator and does not execute the native app. Use it to review composition, pane balance, hinge clearance, and posture ideas before the official Apple simulator or hardware is available.

## Run locally

```powershell
npm install
npm run serve
```

Open `http://127.0.0.1:4328`.

## Checks

```powershell
npm test
npm run verify
```

Three.js is distributed under the MIT license. Its license is included in `dist/vendor/THREE-LICENSE.txt`.
