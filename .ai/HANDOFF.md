# Current Handoff State

## Current objective

Rebased Scout polish item 5 (PR #164) onto main after #165 merged.
Keep Reanimated list skeletons + enter/exit intact. Do not squash-merge
into main from this agent. Do not touch EAS / TestFlight / App Store submit.

## Material changes

- Shared Reanimated skeleton bones (`src/list-skeleton.tsx`) pulse opacity
  only. Reduce Motion / background snaps to a static fill. No Moti.
- Shared list enter/exit/layout (`src/list-motion.ts`) uses FadeIn /
  FadeOut / LinearTransition and disables all three when Reduce Motion
  is on or the app is backgrounded.
- Applied to Soundtracks archive (phone + iPad), Journeys list empty
  load, Memories empty initial load, and JourneyCard row motion.
- Record-active UI in `App.tsx` is unchanged.
- Main now includes #165 (V3 TestFlight live listing / `v3-store`). This
  branch does not change that path.

## Active tree

- Branch: `cursor/scout-list-skeletons-225f` (draft PR #164).
- Rebased onto `origin/main` (`782a651`, #165).

## Verification

- `npm run test:list-skeleton`
- `tests/ipad-music.test.mts`
- `tests/ipad-memories.test.mts`
- `npm run test:tab-runtime`
- `npm run typecheck`
- No EAS Build, no EAS Submit, no App Store/TestFlight upload.

## Unresolved

- Device feel-check on iPhone/iPad with and without Reduce Motion.
- Eng will squash-merge #164 after it is mergeable.

## Next steps

1. Confirm #164 is MERGEABLE against main.
2. Eng squash-merges; this agent does not merge.
