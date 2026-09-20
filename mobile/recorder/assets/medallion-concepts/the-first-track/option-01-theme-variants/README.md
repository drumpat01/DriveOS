# The First Track — option 01 theme demonstration

Selected master: `../01-gold-vinyl-road.png`.

The vinyl sunrise, mountains, musical road, laurel branches, lettering, relief, and circular silhouette remain consistent. The four exports demonstrate how semantic regions can map to JourneyDeck's current palettes.

| Theme ID | Export | Region treatment |
| --- | --- | --- |
| `redline` | `first-track-grand-touring.png` | Navy fields and road, champagne-gold metal, ivory text, silver mountains and markings, racing-green foliage |
| `sakura` | `first-track-rosewater.png` | Blush fields and road, raspberry metal edges and vinyl, dark-plum text, sage foliage |
| `dark` | `first-track-cinematic-dark.png` | Black and plum fields, lavender-chrome relief, warm-white text, coral/amber vinyl, teal and lavender route markings |
| `light` | `first-track-warm-ivory.png` | Ivory fields and road, amber metal, plum text, purple/coral vinyl, teal foliage and dusty-blue mountains |

The runtime selection would be a static mapping:

```ts
const firstTrackArtworkByTheme = {
  redline: require('./first-track-grand-touring.png'),
  sakura: require('./first-track-rosewater.png'),
  dark: require('./first-track-cinematic-dark.png'),
  light: require('./first-track-warm-ivory.png'),
} as const;

const source = firstTrackArtworkByTheme[theme.id];
```

These files are visual proofs and are not wired into the app. For production, the selected master should be separated into deterministic masks or layers before exporting so all four variants share pixel-identical geometry. The generated proofs preserve the composition but may contain small rendering differences in relief texture.
