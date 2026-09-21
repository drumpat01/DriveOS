# JourneyDeck Onboarding reference set

Research date: September 20, 2026

Diagnosis of the shipped flow (five screens: welcome, recording, location, Apple Music, finish) found three precise deficits before any research: (1) progress shown only as tiny "0X / 05" corner text, no native step convention; (2) no back or skip control anywhere — a denied permission traps the user with only a system Alert; (3) every screen reuses the same static sunset photo with no per-step visual anchor, so permission-priming steps (location, music) read as identical text blocks rather than benefit-led asks. Research targeted these three gaps, plus a fourth: the flow does not yet ask the user to consider Membership (Atlas) before finishing setup.

This set was built from category-relevant apps already vetted for JourneyDeck (`research/ui-redesign/home/appllama/apps.md`), one direct road-trip-category match found via semantic search, and a keyword pass for onboarding permission priming. Appllama watermarks are provenance and are not part of the referenced designs.

## Primary references

| App | Screen ref | Why it earned a place | Pattern adopted |
|---|---|---|---|
| Autio: Road Trip & Travel App | `1300494609/onb_txct2` (Location Permission) | Direct road-trip-category match. Centered SF-Symbol-style icon, serif heading, one line of helper copy, one CTA, on an abstract brand backdrop instead of a busy photo. | Icon badge + serif headline pattern adopted for Recording, Location, and Finish steps. |
| Autio: Road Trip & Travel App | `1300494609/onb_boptt` (Notifications Permission) | Same icon-led priming pattern applied to a second permission ask, confirming it as the app's system rather than a one-off screen. | Confirms one repeatable priming skeleton for every permission step. |
| Day One: Daily Journal & Diary | `1044867788/spl_nxika` (Welcome Sign-In) | Warm full-bleed photo, centered brand lockup, rounded CTA, and an explicit skip/secondary link — the closest match to JourneyDeck's existing warm-photo welcome bookend, but with an escape hatch the current build lacks. | Confirms the photo-hero treatment for Welcome/Finish; motivates adding Skip elsewhere. |
| Visited: Travel Tracker & Map | `846983349/onb_nmrba` (Map Selection Tutorial) | Full-width Continue CTA plus a persistent bottom-tab-style progress convention across a long onboarding — evidence that a long flow still needs one consistent, always-visible progress affordance rather than a per-screen label. | Reinforced the case for a single shared progress component instead of restating "0X / 0Y" as body text per screen. |

## Pattern extracted

- **Header, every step but Welcome**: back chevron (left) + dot-progress indicator (center, one dot per step, filled up to current) + optional "Skip" text action (right) — replacing the old top-right "0X / 05" text, which was easy to miss and had no back affordance at all.
- **Permission-priming skeleton** (Recording, Location, Finish): centered circular icon badge (SF Symbol, accent-tinted, on a low-opacity accent fill) above a serif headline, one to two lines of plain-language benefit copy, one full-width CTA. Apple Music keeps its existing app-icon mark, which already matches this skeleton.
- **Skip is granted only where the underlying action is genuinely optional**: Apple Music connect and the new Membership offer both get Skip; Location and Recording explanation do not, since they gate the core recording capability.
- **Membership is offered, not blocked**: inserted as its own stage between Music and Finish, reusing the existing `MembershipPaywall` full-screen modal verbatim (its own "×" doubles as Skip) rather than building a second paywall design — one paywall visual system for the whole app, per the anti-slop "one accent, locked" rule.

## Rejected patterns

- Autio's own multi-step account-creation and story-map onboarding: JourneyDeck's setup is local-first and does not require an account, so those steps do not transfer.
- A photo background behind every permission step: the Autio/Day One evidence favors a calmer, icon-led ask for permission-specific screens, reserving full photo drama for the emotional Welcome/Finish bookends.
