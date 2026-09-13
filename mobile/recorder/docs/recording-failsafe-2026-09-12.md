# Ten-minute inactivity and recorder clock audit — September 12, 2026

Publication is on hold at the user's explicit request. No TestFlight build, OTA,
commit, staging or push was performed. Existing unrelated working changes were retained.

## Findings and corrections

- The threshold is ten minutes of observed non-driving movement, not a maximum
  ten-minute journey. Missing/poor GPS remains unknown; pauses do not count toward
  inactivity. The separate 24-hour ceiling is retained.
- Both Swift and JavaScript replaced their displacement anchor every 15 seconds.
  At 50m accuracy even a stationary phone had an upper speed estimate of 3.33m/s,
  exceeding the 2.2m/s threshold forever. The comparison now retains its anchor
  for 15–100 seconds according to uncertainty, while clearing confirmed driving
  immediately. A regression failed before the fix and passes for parked/walking
  one-second samples at 50m accuracy. Existing driving, drift and gap checks pass.
- The Expo fallback evaluated the UI's latest 500 points. At 1Hz this never spans
  ten minutes. A separate owner-scoped 15-minute query now supplies the policy.
  The actual storage/SQLite regression demonstrates the old tail failing and the
  new window finishing the same session with a single completion claim.
- Native status/reconciliation can now finish a due inactivity interval when the
  last observation was a resolved baseline and is at most 60 seconds old. It does
  not infer parking from missing GPS or use another journey's persisted policy.
- The clock previously used wall time regardless of pause/finish/transport state.
  It now freezes on pause, finish or unconfirmed recording; uses a stored end time
  when available; and caps extrapolation at ten seconds after a successful status
  confirmation if refresh hangs. Home shows checking/finishing instead of claiming
  recording. A stale inbox mirror remains retryable and is not falsely completed.
  The detailed recorder uses the same label and explicit one-second state tick.
  This is elapsed session time, not a new accumulated GPS-active-time metric.
- Legacy local completion no longer awaits Keychain or optional enrichment. An
  unknown connection retains a retryable remote-completion job. Executable runtime
  tests exercise hung credentials/enrichment, overlapping finishes, and transport
  stop rejection; saved local state remains completed.

## Verification and limits

- Complete mobile test suite: 570/570 passed, including the production App refresh
  regression for native completion with a stale recording mirror.
- TypeScript passed. Local iOS export passed (2,503 modules, 77 assets, 8.5MB
  Hermes bundle), output `.cache/recording-failsafe-export`.
- `git diff --check` passed with existing line-ending notices.
- The Swift policy harness was extended, but its command cannot run here:
  `Swift compiler unavailable`. No Swift compilation or physical iPhone/Watch
  verification is claimed. The Swift changes require the next authorized native build.
- Still callback/status driven, not a guaranteed wall-clock alarm. Native fixes
  older than 60 seconds are ignored; gaps over 120 seconds, invalid/ambiguous GPS,
  force-quit and suspended execution can delay/prevent the ten-minute decision.
  The 24-hour ceiling also requires execution. Freezing the UI does not prove that
  an unresponsive native transport has stopped.

Before release, run `node scripts/test-watch-native-policy.mjs` with Swift, compile
the native app, and test locked-phone parking/walking, resumed driving near the
boundary, GPS loss/recovery, pause/resume, Watch stop then immediate start, and
foregrounding during a delayed inbox import. Confirm GPS, timer and one saved
journey agree. Review phone/iPad layouts and larger Dynamic Type for the status copy.
