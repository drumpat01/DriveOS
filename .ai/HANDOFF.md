# JourneyDeck current handoff

## Current objective

Point the V4 onboarding Tesla note at Settings, Music & Connections. Open a draft pull request off main. Do not merge and do not deploy.

## Checkout

- Branch `cursor/tessie-settings-copy-1783`, based on main `102a13b`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/300. Do not merge it.

## Material changes

- `mobile/recorder/src/first-run-v4.tsx` now says: Connect Tessie later in Settings › Music & Connections and JourneyDeck will add your Tesla trips automatically.
- The live Settings category title is `Music & Connections` (`settings-categories.ts`, id `music`). Tessie lives in that category on iPhone and iPad.
- No other app copy named Settings Recording as the Tessie destination. Status lines such as "Automatic recording with Tessie" were left as they are.

## Verification

- `npm run typecheck` in `mobile/recorder` passed.
- `node --experimental-strip-types --test tests/first-run-v4-flow.test.mts tests/first-run-flow.test.mts tests/first-run-welcome.test.mts`: 9 passed, 0 failed.
- No EAS build, submit, or deploy.

## Unresolved

- Do not merge and do not deploy.

## Next steps

1. Leave the draft pull request open until the owner merges it.
