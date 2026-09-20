# JourneyDeck: free and mostly free development tools
Research date: September 5, 2026. Scope: recommendations after POI and iPad Statistics; no installations, account changes, builds, OTAs, submissions, or new monitoring jobs authorized by this research.

## Recommended order

1. Use configured Data Analytics, Codex Security and Cloudflare skills deliberately.
2. Add the official Expo skills/MCP; add focused Callstack performance/testing and SwiftUI skills.
3. Audit existing Observe wiring and read real release metrics before buying another analytics product.
4. Add repeatable native UI testing when a Mac runner and a simulator build are authorized.
5. Consider Sentry for native crash diagnostics. Keep PostHog optional until there is a concrete product-analytics question.
6. For a future user-visible feature, prioritize widgets/Live Activities over more decorative effects.

These are recommendations based on project fit, not a survey claiming what most developers use. Sources favor maintainers' documentation and repositories.

## What is already configured and underused

| Available skill/tool family | Practical JourneyDeck use |
| --- | --- |
| Data Analytics: design-kpis, analyze-data-quality, validate-data, visualize-data | Define and independently verify Statistics formulas: miles, elapsed versus active driving time, observed listening minutes, distinct tracks, active days, time zones and membership windows. Validate Overture US coverage and missing/ambiguous matches with public or synthetic samples. |
| Codex Security: security-diff-scan, verify-fix | A scoped review of changed POI/network, private CloudKit, photo/export, and Watch command boundaries; verify fixes before release. |
| Cloudflare: workers-best-practices, wrangler | Inspect R2 range/cache behavior and Worker failures; create useful operational summaries for POI without recording queried locations or user histories. |
| Visualize and browser/computer-use | Interactive Statistics prototypes to test time filters, chart selection and narrow widths before native implementation. Browser previews do not prove native gestures or Watch behavior. |
| GitHub connector/CLI and existing CI | Review checks and artifacts and eventually add mobile-specific CI. The inspected journeydeck-ci.yml uses Windows and root npm tests; it contains no explicit native simulator job. |
| Skill Creator | A compact JourneyDeck readiness workflow could connect metric validation, targeted security review and evidence collection while retaining the release hold. Avoid duplicating the existing handbook. |

The session exposes these capabilities, but this does not establish that every external account is authenticated, or that they have never been used in another task. Local skills use existing Codex usage; they do not make model computation free.

## Actual repository findings

- package.json declares Expo ~57.0.19, React Native 0.86.3, expo-observe ~57.0.18, @expo/ui, Skia, Reanimated, FlashList, glass and mesh gradients.
- Observe is wrapped around App, an interactive marker exists, and recorder/sync events are emitted. In src/observability.ts, the release attribute still says N1.9-B13, sampleRate is 1, and all non-debug environments are named production. Recommend deriving the actual release and distinguishing V2 preview before comparing metrics. Source wiring is not proof of dashboard ingestion.
- Native tabs, menus, glass effects and Reanimated gestures are already used. We should measure their performance before adding more visual machinery.
- No FlashList usage was found in the inspected app source. Use virtualization only where measured long-list costs justify it.
- No expo-widgets dependency or widget/Live Activity implementation was found in the scoped search.

## Best additions

### Official Expo skills and MCP — first choice

Official framework skills cover Router, native UI, Expo modules and upgrades; the service skills include Observe and update health. The plugin bundles an MCP connection. Framework skills are open source. [Expo skills repository](https://github.com/expo/skills).

The remote MCP can read build information, logs and TestFlight feedback/crashes, and provide documentation. On Windows, those remote operations are useful. Local iOS automation requires a macOS host and simulator; physical iOS automation is not supported by Expo MCP's documented local capabilities. Documentation search is specifically marked paid, while the pricing table lists fair-use-limited MCP access on Free. Do not interpret “free MCP” as every feature being free. [Expo MCP documentation](https://docs.expo.dev/mcp/), [Expo pricing](https://expo.dev/pricing).

### Callstack skills and Agent React DevTools — performance evidence

Callstack's MIT-licensed skills cover React Native performance, testing, navigation and CI. Good fit for memory-gallery scrolling, Statistics charts and excessive tab re-renders. [Callstack skills](https://github.com/callstackincubator/agent-skills).

Agent React DevTools is a separate experimental MIT-licensed CLI that reads component trees, props/state and render profiles. It can identify slow or repeated renders and emits compact agent-oriented output. Trial it against synthetic development data; runtime/host compatibility with this exact SDK must be checked before adoption. It is a CLI workflow, not a requirement to add another hosted MCP. [Agent React DevTools](https://github.com/callstackincubator/agent-react-devtools).

### SwiftUI Expert — Watch source review

AvdLee's MIT-licensed skill covers state, view composition, performance and modern SwiftUI. Useful for reviewing the Watch companion's small-screen layout and state transitions. Guidance can be used from Windows; compilation and real Watch testing still require Apple tooling/devices. [SwiftUI Expert](https://github.com/AvdLee/SwiftUI-Agent-Skill).

### Context7 — optional documentation complement

Free plan includes 1,000 API calls/month to public repository documentation; private repository support is paid. Useful for Reanimated, Skia and MapLibre documentation beyond Expo. No need to upload JourneyDeck's private repository. Add only if official docs and Expo MCP leave recurring gaps. [Context7 plans](https://context7.com/plans).

## Monitoring: use what is installed first

EAS Observe supports production startup and route timing, release comparisons and CLI queries; JS error reporting is in preview and native crashes are not captured. First verify receipt of the existing metrics and repair labels, then compare iPad/iPhone startup and screen readiness by release. [Observe introduction](https://docs.expo.dev/eas/observe/introduction/).

Free includes 100,000 events/month. Expo's pricing table gates navigation/custom-event/error/update dashboards above Free; Starter is $19/month plus usage with 500,000 included Observe events. The actual account plan was not checked. Read existing entitled data before recommending payment. [Expo pricing](https://expo.dev/pricing).

| Optional service | Concrete use | Free boundary |
| --- | --- | --- |
| Sentry + official MCP | Investigate native phone crashes and JS failures with stack traces. Watch coverage needs separate verification/instrumentation. | Developer: $0, one user, 5,000 errors, MCP access. Profiling and Seer have separate paid conditions. |
| PostHog + official MCP | Explicit product questions such as whether onboarding is completed or Memory creation succeeds. | 1 million analytics events/month; no-card Free stops at limits. It would add a new telemetry destination. |
| Cloudflare Workers Logs/MCP | POI request failures, duration and cache/range diagnostics. | Workers Free: 200,000 log events/day, 3-day retention. R2/request usage remains separately metered. |

Sources: [Sentry pricing](https://sentry.io/pricing/), [Sentry MCP](https://mcp.sentry.dev/), [PostHog pricing](https://posthog.com/pricing), [PostHog MCP](https://posthog.com/docs/model-context-protocol), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Cloudflare observability/MCP](https://developers.cloudflare.com/workers/observability/).

Recommendation: Observe first, Sentry if native crash evidence is missing, PostHog only for a defined need. Keep coordinates, titles, photos, profile identity and route histories out of third-party telemetry. Do not enable session replay for the private journal by default.

## Native testing and the Windows constraint

Maestro's Apache-2.0 CLI and free Studio can make tab navigation, theme switching, forms and basic journey flows repeatable. Its official MCP is available. The iOS simulator still runs on Mac hardware; Maestro Cloud is a paid service with a trial. [Maestro](https://github.com/mobile-dev-inc/Maestro), [MCP](https://docs.maestro.dev/getting-started/maestro-mcp), [iOS requirements](https://docs.maestro.dev/getting-started/build-and-install-your-app/ios).

XcodeBuildMCP can give an agent native build/debug workflows, but requires macOS and Xcode; installing it on this Windows PC does not remove that requirement. [XcodeBuildMCP](https://github.com/getsentry/XcodeBuildMCP).

A future GitHub macOS job could validate Swift and run simulator checks after explicit build authorization. GitHub Free includes 2,000 standard-runner allowance minutes and 500 MB artifact storage; macOS consumes allowance differently and is more expensive than Linux. This is not 2,000 free Mac minutes. Keep artifacts short-lived and verify budgets. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Cloud simulator products were not shortlisted as free: a reliable current free entitlement was not established. Tests on synthetic simulator data also cannot certify paired Watch connectivity, GPS background recording or real private iCloud sync.

## SDK capabilities worth using next

- **Widgets and Live Activities:** a Home Screen summary and a visible recording state/elapsed time are strong future additions. SDK 57's expo-widgets supports both through Expo UI. No recurring SDK service fee; adds a native extension/app group and requires a later authorized native build. Background updates need integration with the phone recorder lifecycle and device validation. [SDK 57 widgets](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/).
- **More native controls:** use @expo/ui pickers, popovers and form controls selectively for Statistics filters and iPad editors. Preserve JourneyDeck's theme. [SDK 57 Expo UI](https://docs.expo.dev/versions/v57.0.0/sdk/ui/).
- **Image caching:** SDK 57 adds writeToCacheAsync/readFromCacheAsync, worth evaluating for offline artwork. Cache is disposable and must not replace original private-photo persistence.
- **Development profiling:** RN 0.86 adds theme emulation and rendering/layout fixes. The declared RN 0.86.3 version already includes Expo's documented memory/startup regression fixes, so this is an audit of existing capability rather than a reason to upgrade blindly. [SDK 57 release notes](https://expo.dev/changelog/sdk-57).

The versioned docs and release notes were used for SDK-specific recommendations; unversioned docs can mention unreleased SDK 58 behavior.

## Deferred or unnecessary

No need for another backend, AI inference platform, paid design pipeline, or overlapping analytics suite to finish V2. Render skills remain relevant to the existing desktop/web host, while Cloudflare is the direct match for mobile POI. Imagegen is already serving concept work; future chart correctness should come from deterministic data and chart validation.

Research used official Expo, Cloudflare, GitHub, Sentry, PostHog, Context7, Maestro, Callstack and SwiftUI skill-maintainer sources. Prices are public plan limits as read on the research date, not confirmed account entitlements. Plugin marketplace search/install tools were not exposed in this session; tool and skill inventory was available. No new integration was installed or authenticated.
