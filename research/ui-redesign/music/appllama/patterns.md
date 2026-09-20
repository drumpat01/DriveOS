# JourneyDeck Music synthesis

## Findings from the current phone UI

1. The page repeats the same archive in three long sections: Top artists, Listening history, and Top tracks.
2. The oversized soundtrack carousel delays the useful journey-linked archive.
3. Cities, listening-time, mood, and weekly panels reserve large areas even when their data is empty.
4. The four summary metrics require a full grid despite being secondary context.
5. The floating tab bar can obscure the final rows because the scroll content does not reserve enough bottom space.

## Applied visual hierarchy

1. **Latest road soundtrack** — one artwork-led, tappable recent play.
2. **Summary rail** — miles, listening hours, songs, and streak in compact horizontally scrollable cards.
3. **Listening history** — five journey-linked plays by default, searchable, with explicit View all and Show less controls.
4. **Your sound** — one segmented Artists/Tracks ranking with five rows per mode.
5. **Road insights** — week mileage and plays consolidated into one compact card; mood, cities, and listening-time cards render only when backed by data.

The redesign preserves local-first data, provider behavior, refresh, journey navigation, track deep links, theme variants, and the existing iPad surface. It introduces no native module, asset, permission, or configuration change and remains EAS Update compatible.

