# JourneyDeck Theme Creator

A standalone local palette studio. Run from the repository root:

```powershell
node tools/theme-creator/server.mjs
```

Open http://127.0.0.1:4317. The server binds only to loopback and serves only the editor files and five screenshot assets. No dependencies, build, account, external fonts, analytics, or network APIs are required.

## Usage

Select one of 10 roles. Drag the saturation/brightness field and hue slider, or enter HEX/RGB values. Arrow keys operate the color field (Shift uses larger increments). Changes update all five previews. Save with a name for one-click recall; names already in use receive a numeric suffix. The current palette and presets persist in this browser at this exact local origin. Export/import JSON for portable palette backups. Reset restores the initial colors without removing presets. View originals toggles to the supplied screenshots for comparison.

## Built-in app themes

The **App themes** section includes Cinematic Dark, Grand Touring, Autumn Drive (V3 preview), Warm Ivory, and Rosewater. These presets use the current app catalog colors, captured from `mobile/recorder/src/theme-catalog.ts` on September 17, 2026. They are always available independently of browser-saved presets. Click to apply, adjust colors, then save a named variation; edits never overwrite a built-in preset or existing custom presets.

Catalog roles map to editor roles as follows: `page → base`, `card → card`, `inset → raised`, `line → border`, with `text`, `muted`, `accent`, and `onAccent` retained. `blue → active` and `accent → glow`; Autumn uses `rose → active` for its red recording treatment and the explicit `glow` token for its orange warmth. Its built-in preset now matches the user-selected "test 4" applied to the app source. Multiple native roles are consolidated, so these remain theme approximations within the ten-role preview system. Reset still restores the original screenshot palette.

## Categories

1. Base background — pages, Home background, map land (`page/chrome`).
2. Card surfaces — recorder, memory, journey, music, metric panels (`card`).
3. Controls & navigation — tab bar, icon badges, back/overflow, map controls/water (`inset`).
4. Borders & dividers — outlines, separators, frames, rings (`line`).
5. Primary text & icons — titles, body labels, values, inactive navigation, map roads (`text`).
6. Secondary text & icons — descriptions, dates, artists, units, map labels (`muted`).
7. Highlights & actions — headings, primary action fills, selected icons, ready beacon, route and pin outlines (`accent/amber`).
8. Text on action buttons — labels/icons on filled actions (`onAccent`).
9. Active & recording — selected navigation fill, recording beacon, section markers, map song-pin fill (`active/blue`).
10. Atmosphere & glow — ambient light, halo and beacon/route glow, retaining opacity.

These groups are based on the supplied screenshots and the mobile theme palette/catalog. Several real app tokens are consolidated to keep the editor at 10 categories. Alpha remains part of the component styling.

## Preview fidelity and privacy

The five screens are editable SVG recreations, not the native app or exact pixel-for-pixel screenshots. Text and icons are recreated. The original memory photo, car photo, and album art are displayed through clipped screenshot images without color filtering; hero photos use a clean text-free crop with newly themed overlay text. The journey map is recolored locally from the screenshot using an approximate color-role classification. The Home background photo is omitted in both live Home previews. The original comparison intentionally shows the unmodified screenshots.

Screenshot files are private local inputs ignored by Git. On another machine copy the supplied files to `assets/` as follows:

| Input | Local filename |
| --- | --- |
| IMG_4995.PNG | home.png |
| IMG_4996.PNG | recording.png |
| IMG_4997.PNG | journey.png |
| IMG_5003.PNG | memory.png |
| IMG_5005.PNG | music.png |

Palette exports contain only names, colors, and category descriptions. They do not include screenshot data. Nothing is applied to JourneyDeck or published. This is a design tool; its exported role specification needs explicit implementation mapping before it can become a native theme.

## Checks

```powershell
node --test tools/theme-creator/model.test.mjs
node tools/theme-creator/verify.mjs
```

The browser check uses the repository's existing Playwright dependency and a running local editor server. It verifies all 10 roles update previews, protected artwork references remain intact, presets survive reload, malicious preset names render as text, import/export, original comparison, and narrow viewport layout.
