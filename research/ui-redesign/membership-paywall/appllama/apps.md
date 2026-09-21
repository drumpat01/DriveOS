# JourneyDeck Membership paywall reference set

Research date: September 20, 2026

Real-device feedback on the shipped screen: cluttered and unwelcoming — a 2x2 bordered feature grid, a separate bordered "history" row, small plan cards, and a fixed magenta/pink gradient scheme that doesn't match any of JourneyDeck's actual themes (Grand Touring navy/gold, Warm Ivory, Midnight Canopy). The user asked for something more welcoming, more minimal, and easier to scan for benefits.

## Reference set

Four candidates were pulled via one keyword and one semantic Appllama search for minimal, benefit-led subscription paywalls, then narrowed with `get_screen`'s `similar_screens`:

| App | Screen ref | Pattern | Verdict |
|---|---|---|---|
| RV LIFE - RV GPS & Campgrounds | `1275803975/pay_y4i96` | Same road-trip category; light, centered dual pricing cards | Useful category proof, but visually flat for JourneyDeck's cinematic language |
| Calm | `571800810/pay_ugkou` | Industry benchmark for minimal/welcoming: one plan sheet, huge whitespace | Strong reference for restraint, but Calm has no hero photo to build from |
| Duolingo | `570060128/pay_uspfr` | Playful mascot + benefit checklist | Too illustration-heavy/mascot-driven for JourneyDeck's photography-led identity |
| **Photomator** | `1444636541/pay_jck97` | **Selected.** Full-bleed photo hero with the title overlaid directly on the image, plain plan cards below, one primary CTA | Matches JourneyDeck's existing cinematic-photo identity (already used, just underexploited, in the old design) while reading far calmer than the old bordered-card layout |

The user reviewed all four screenshots directly and picked Photomator's pattern.

## Pattern adopted

- **Full-bleed hero**: the existing `cinematic-membership-photo-v1.jpg` now fills roughly the top 40–45% of the screen (not a small bordered box), with the eyebrow/title/subtitle overlaid directly on a bottom gradient fade into the page background — no glow, no neon border.
- **Benefits as a plain list, not a card grid**: each of the five benefits (Pattern Intelligence, Favorite Places, Journey Studio, Your Year on the Road, Complete History) is one row — a small accent-tinted SF Symbol badge, a title, and one line of copy — separated by hairline dividers instead of individual bordered boxes. This is the single biggest legibility win: five short lines read faster than a 2x2 grid of boxed abstract icon shapes.
- **Theme-native color**: replaced the fixed magenta/pink gradient scheme with `journeyDeckSemanticColors(theme.id, theme.palette)` — the same token function already used by the redesigned Home widget grid — so the paywall now matches whichever theme (Grand Touring, Warm Ivory, Midnight Canopy, etc.) the user actually has selected, instead of a jarring unrelated palette.
- **Simplified plan cards**: two cards side by side, selection shown with a soft accent-tinted fill rather than a colored glow/shadow; price uses the existing serif display font for consistency with the rest of the app.
- **One CTA, minimal footer**: kept the single dynamic-price CTA and the Restore/Privacy/Terms row, restyled as plain text rather than bordered pill buttons.

## Rejected patterns

- Calm's single centered plan sheet with no hero image: would waste JourneyDeck's existing cinematic photography, which is the app's strongest visual asset.
- Duolingo's mascot illustration: JourneyDeck's brand voice is photography-led (real driving/road imagery), not character-illustration-led; introducing a mascot here would be a new, unestablished visual language.
- Discount ribbons / "sale" badges (seen in RV Life, Dancefit, MeAgain): JourneyDeck's pricing doesn't currently include time-limited discounts, so a permanent "50% off" ribbon would be misleading marketing rather than an honest UI pattern.
