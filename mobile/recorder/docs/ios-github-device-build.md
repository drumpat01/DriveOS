# V3 registered-device build on GitHub

The manual `ios-v3-device.yml` workflow compiles the complete JourneyDeck V3 app and
its Watch companion on the standard `macos-26` runner in the existing public mobile
snapshot repository. It never invokes EAS Build or starts a simulator/video stream.
It allows 60 minutes for Xcode compilation within a 90-minute job. Dependency caches
are reused; signed apps, certificates and provisioning profiles are never cached.

Signing blobs are **not** stored in the GitHub Secrets UI. At archive time the
workflow injects the six existing environment names from 1Password with
`1password/load-secrets-action@v5` (`export-env: true`). The only GitHub secret
allowed for this job is `OP_SERVICE_ACCOUNT_TOKEN`. Do not add `.p12` files,
provisioning profiles, UDIDs, or the artifact password to GitHub Secrets.

The injected names are unchanged; `prepare-ios-signing.py` still reads them as
environment variables:

| Environment name | Purpose |
| --- | --- |
| IOS_DISTRIBUTION_P12_BASE64 | Existing distribution certificate with private key |
| IOS_DISTRIBUTION_P12_PASSWORD | Certificate password |
| IOS_V3_PROFILE_BASE64 | **Ad hoc** profile for com.journeydeck.recorder.v3 |
| IOS_V3_WATCH_PROFILE_BASE64 | Matching .watchkitapp **ad hoc** profile |
| IOS_TEST_DEVICE_UDID | Registered iPhone identifier, used only for validation |
| IOS_ARTIFACT_PASSWORD | At least 32 cryptographically random characters |

App Store / App Store Connect profiles will fail the signing preflight. Store
already-base64 text in 1Password (not GitHub). Key Master setup:
[ios-1password-ci.md](ios-1password-ci.md).

The existing V3 profiles were checked through the authenticated EAS credential
reader and already include the user's iPhone. No new Apple certificate or device
registration is needed based on that readback. The workflow rechecks the downloaded
profiles, expiration, CloudKit, Apple sign-in, team and certificate before compiling.
Xcode additionally validates all actual app entitlements against those profiles.

The one-day GitHub artifact is encrypted because an IPA embeds a profile containing
device identifiers. Decrypt it locally using OpenSSL AES-256-CBC, PBKDF2, 200000
iterations and SHA-256 with the same password supplied through an environment
variable. Do not place the password in shell history. Verify the artifact hash first.
Provide the decrypted IPA through a temporary HTTPS installation manifest available
only through an unguessable installation link; stop hosting after installation.
The encrypted artifact itself is not an iPhone installation link.

The build retains the V3 identity and CloudKit container, runtime preview.4, internal
testing flag and v3-preview OTA channel. It must not target the old marker-compatible
runtime preview.2. The old V2 App Store identity remains frozen.

After source checks, the workflow computes an iOS `@expo/fingerprint` **balanced**
hash and compares it with `native-fingerprint.ios.json`. An unchanged hash skips
prebuild/archive/export and prints the EAS Update command instead of compiling.
There is no committed hash yet, so the first run still archives (fail closed).
Pass `force_native` to archive anyway. After a successful archive, commit the
hash from the `journeydeck-v3-ios-fingerprint` artifact so later JS-only runs
skip Xcode. The workflow never publishes an update or invokes EAS Build.
See [expo-ci-update-path.md](expo-ci-update-path.md).

Device validation starts at Ask JourneyDeck → Open Siri AI testing → Run 13-question
sample, followed by the complete 100-question suite. Then check real archive answers,
Siri invocation/replies, follow-ups, profile switching, locking during inference,
airplane mode, recording and marker controls, VoiceOver and large text. iPad native
layout acceptance remains separate. A passing JS suite is not a native build or
Apple Intelligence accuracy result.
