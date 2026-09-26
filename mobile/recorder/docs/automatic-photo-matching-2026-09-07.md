# Automatic Photo Matching — implementation and acceptance

## Scope

Free for every JourneyDeck membership. A person opens a saved Memory, explicitly chooses **Find matching photos**, permits Photos access, reviews suggestions, selects up to 24, and adds those copies to that Memory. Suggestions never create or alter journeys and nothing is automatically imported. Photos are matched against the selected Memory's journeys, not the entire device archive.

The responsive review uses the active theme palette (Cinematic Dark, Warm Ivory, Rosewater, Grand Touring). It uses two columns on iPhone, three on narrow iPad, and four on wider iPad. A short thumbnail fade respects Reduce Motion; it does not change matching or selection. Selection survives a theme change. A background, owner/Memory change, close, or unmount invalidates pending reads and import callbacks. Owner/Memory changes remount the review before rendering, preventing a flash of previous private thumbnails.

## Permissions and provider choice

- [Expo SDK 57 MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/) was evaluated. A small Expo Modules Core PhotoKit module is used because this feature needs a single bounded permission/session boundary, hidden-photo exclusion from automatic suggestions, no unsolicited iCloud asset downloads, and pixel-only selected exports. No new JavaScript/native third-party package is required.
- iOS requires `NSPhotoLibraryUsageDescription`. Suggested purpose: “JourneyDeck uses the dates and saved locations of photos you allow to suggest pictures for your Memories. You choose which photos to add.” Changes to this purpose string/module require a new native build.
- The explicit scan action requests PhotoKit `.readWrite` authorization; Apple does not offer a read-only access-level enum. This implementation never writes, deletes, or modifies the user's Photos library. `.addOnly` cannot read metadata and is insufficient. [PhotoKit authorization](https://developer.apple.com/documentation/photos/phphotolibrary/requestauthorization(for:handler:)).
- Full and limited access are supported. Limited access searches only authorized assets and exposes Apple's limited-library selection sheet. Denied/restricted access is explained with a Settings path. Consider `PHPhotoLibraryPreventAutomaticLimitedAccessAlert = YES` in Info.plist because the feature already provides an explicit “Choose photos” action.
- The feature reads each permitted [PHAsset.location](https://developer.apple.com/documentation/photos/phasset/location), which is metadata saved with that photo. It does **not** request Core Location/device location permission, start GPS, request camera access, or request microphone permission. Photos without available location can still be suggested by time with an explicit “Time only” label. Existing recording permissions are unrelated.
- [Hidden assets](https://developer.apple.com/documentation/photos/phfetchoptions/includehiddenassets) are excluded in both the query and per-asset preview/export revalidation. Screenshots and burst alternates are excluded. Only still images are supported; Live Photos contribute their still frame. Video matching is deferred.

## User choice

JourneyDeck does not analyze photo content for sensitivity. The person reviews and selects every suggested photo before import. The separate Add Photo picker in a Memory accepts any image the person chooses, including one that does not meet automatic time/location suggestion rules. Photo format, local availability, and private-library size limits still apply.

## Matching and privacy

- Valid, completed, dated journeys only; latest 30 per review, maximum journey duration 30 days. Metadata query covers their actual windows plus 30 minutes around arrival/departure, not an unrestricted library crawl.
- Native metadata fetch is capped at 401, returning at most 400. Matching returns at most 120 suggestions. Truncation is disclosed and a smaller Memory narrows the search. Hidden/screenshots can consume the fetch bound, so the number returned may be smaller than 400.
- A photo must fall in a journey time window. If photo location and a valid recorded route exist, the location must be within 600 meters of the route. A remote GPS location is rejected even when the timestamp matches. Missing GPS is a weaker time-only suggestion. Duplicate assets/overlapping journeys yield one deterministic best match.
- Geometry sampling is bounded to about 2,000 points per route. Long spatial jumps (over 5 km) or timestamp gaps (over five minutes) are not connected into invented corridors. Matching tolerances are suggestions, not evidence of an exact photo capture position along the trip.
- Native previews/imports must belong to a live, unexpired scan and remain permitted/not hidden when the async photo request and encoding finish. Image requests have count/time limits and cancellation fences.
- PhotoKit image requests disallow network access. iCloud-only image files that are not locally available instruct the user to open/download them in Photos and retry. Metadata/photo bytes are not sent to a recommendation server.
- The native module renders fresh bounded JPEG pixels, removing original EXIF/GPS metadata and the original filename. Only photos the user selects pass to the app's existing private Memory photo persistence contract. Those selected copies follow the app's existing private iCloud sync settings; “on-device matching” does not claim that selected saved photos never sync.
- Raw PhotoKit identifiers and source coordinates must not appear in telemetry, logs, diagnostic exports, or synced metadata. Root integration may use an owner/Memory-scoped hash/digest to deduplicate repeat imports. The review itself remembers successful assets so partial retries do not repeat them.

## Integration contract

`PhotoMatchingScreen` in `src/photo-matching-screen.tsx` accepts:

```ts
{
  reviewKey: string; // owner ID + Memory ID; change or key-remount on identity change
  memoryName: string;
  journeys: readonly PhotoMatchJourney[];
  onImport: (photo: MatchedPhotoImport, match: PhotoMatch) => Promise<void>;
  onClose: () => void;
}
```

`PhotoMatchJourney` provides `{id, title, startTimeUtc, endTimeUtc, route: [{latitude, longitude, timestampUtc?}]}`. `onImport` must bind to the original owner and Memory, verify they still exist before/after asynchronous boundaries, and persist through the existing private Memory photo API. It must not claim success until durable persistence completes. Root integration is responsible for persistent deduplication and surfacing newly added photos in the Memory view.

Old binaries resolve the bridge with `requireOptionalNativeModule`, show that Photo Matching requires the next app build, and retain manual photo import. There is no startup requirement for PhotoKit availability.

## Verified and remaining

`node --experimental-strip-types --test tests/photo-matching.test.mts` covers time/geography/invalid coordinates, missing location, recording gaps, edge padding, duplicate/overlap, limits, dateline, explicit permission/denial, reviewed-only import, partial failures and retry deduplication, theme selection, background cancellation, identity-change rejection, and old-native-build fallback. Native source invariants assert access/session/hidden/offline boundaries, no content analyzer, and bounded in-flight decoding. Run targeted tests and typecheck after changes.

Swift is **source-reviewed, not compiled or run on this Windows workstation**. Before release, build and test on iPhone and iPad:

1. First access: full/limited/deny/restricted, Settings changes, limited picker, returning from authorization UI; no scan before explicit action.
2. Real PhotoKit timestamp and location metadata: no GPS, timezone/time edits, HEIC, rotated photos, Live Photo stills, screenshot/hidden exclusion, missing/deleted/revoked assets, iCloud-only assets, large libraries and no-match results.
3. Background/close/owner switch during scan, preview and import; active Memory deletion; interrupted/low-space writes; partial retry and reopening a Memory without duplicate copies.
4. Confirm content sensitivity never prevents a selected photo from appearing or importing. Confirm the separate Add Photo picker can add an image outside the suggestion rules.
5. iPad portrait/landscape/Split View, large text, VoiceOver selection announcements, theme change, thumbnail memory pressure, and smooth scrolling on older devices.

No OTA, native build, TestFlight submission, user Photos mutation, or real user archive import was performed during this implementation.
