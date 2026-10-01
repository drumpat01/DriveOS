# Prompt for Codex: journeydeck.me updates for JourneyDeck 4.0

Paste everything below the line into Codex.

---

JourneyDeck 4.0.0 replaces the live App Store version (2.0) and adds features the website does not describe. Update the journeydeck.me site so it matches the app. Apple reviews the privacy policy URL, so accuracy matters more than polish. Read the current pages first and change only what is missing or wrong. Do not invent features or claims; use only the facts below. Show me the diff before anything is published.

## 1. Privacy policy (https://journeydeck.me/privacy), most important

The live page does not mention any of the following. Add plain-language sections for each, in the page's existing tone, and update the "last updated" date.

**A. Connecting an AI assistant (Claude), optional, JourneyDeckPlus only**
- A user can connect an AI assistant such as Claude from Settings > AI Assistants. The connector runs at mcp.journeydeck.me on Cloudflare (Workers, Durable Objects, KV).
- The user signs in with Apple on an authorization page and chooses what the assistant may see with switches: Music, Routes & locations, Memories & markers, Photos, Home & Work. Each assistant has its own switches, editable later in the app, and a Disconnect button. An assistant sees a category only if both the app-wide setting and its own setting allow it.
- The connector is read-only: it reads the user's own JourneyDeck data from their private iCloud (CloudKit) using their authorization, and never writes to iCloud.
- The app links itself to the connector with a random secret kept in the iPhone Keychain; only SHA-256 digests of it are synced.
- Access requires an active JourneyDeck Plus subscription, which the connector confirms with the App Store Server API.
- Data the assistant requests is returned to the assistant the user connected, and is then handled under that assistant provider's own terms and privacy policy (for example Anthropic for Claude).
- Facts I could not confirm from the app code and you should NOT state unless you find them in the connector repo (`drumpat01/journeydeck-data-mcp`): how long the connector keeps grants or caches, and what it logs. If the repo answers these, state them; if not, leave them out and list them for me as open questions.

**B. Tessie (optional, Plus)**
- Tesla owners can connect their own Tessie account. The Tessie token is stored in the iPhone Keychain for the current profile. The app reads vehicle, drive, charge and route data from Tessie and caches a summary on the device. Disconnecting removes the cached data. This is separate from JourneyDeck's recorded journeys and from private iCloud sync.

**C. Ask JourneyDeck (Plus)**
- Questions are answered from the user's archive on the device. Apple's on-device model is used when the device supports Apple Intelligence; otherwise built-in rules answer supported questions. Questions and answers are not saved and are not sent to JourneyDeck servers. Available in the app and through Siri.

**D. iPad**
- iPad shows the library but does not record. It receives data from the user's iPhone through the user's private iCloud.

**E. Sample library**
- A fictional sample library can be turned on in Settings > Account. It is created on the device, never uploaded or synced, and is removed when the user leaves it.

**F. Other V4 data**
- Journey Markers (notes and photos added during a drive) and Memory photos are stored on the device and sync only through the user's private iCloud.
- The Start a Journey widget and Apple Watch app share only the minimum needed (for example the last drive) with the iPhone app on the device.
- Subscriptions: purchase and entitlement status come from Apple's StoreKit; JourneyDeck does not receive payment details.

Keep the existing statements about local-first storage, no tracking, no ads, optional Apple sign-in, optional Apple Music, ShazamKit microphone use, and deleting data. Do not weaken them. If anything above contradicts an existing statement, tell me instead of silently picking one.

## 2. Support page (https://journeydeck.me/support)
Add short answers for: iPad shows my library but cannot record (recording needs an iPhone); sample data (what it is, how to leave it); JourneyDeck Plus (3-day trial for every new install, then free recording with today's journeys; weekly or annual subscription unlocks full history, Atlas, Ask JourneyDeck, premium themes and icons, Tessie and AI assistant connections; older journeys are never deleted; Restore Purchases is in Settings > Membership); how to disconnect an AI assistant (Settings > AI Assistants > Connected assistants > Disconnect); first iCloud sync on a new device can take a few minutes and may say items are still arriving.

## 3. Home / marketing page (https://journeydeck.me/)
Bring the feature list up to date for 4.0: redesigned iPhone and iPad app with native navigation (Today, Memories, Soundtrack, Atlas); Ask JourneyDeck; Memories with photos; Atlas; Journey Markers; the Start a Journey widget; six themes with matching icons (Grand Touring and Warm Ivory free; Cinematic Dark, Rosewater, Autumn Drive and Aurora Glass with Plus). Store screenshots are in the JourneyDeck repo at `mobile/recorder/store/screenshots/final/` (git-ignored, on my machine; ask me and I will supply them) if the page uses imagery. Do not mention prices.

## 4. Terms
Check that any Terms page referenced from the site (the App Store listing links Apple's standard EULA) does not contradict the above. Report findings; do not rewrite legal terms.

## Constraints
- No new tracking, analytics or third-party scripts.
- Keep existing URLs working; do not rename pages.
- Match the existing design system and copy style.
- Deliver: a short list of what changed, any open questions, and the diff. Do not deploy until I approve.
