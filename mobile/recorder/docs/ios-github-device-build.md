# V3 registered-device build on GitHub

The manual `ios-v3-device.yml` workflow compiles the complete JourneyDeck V3 app and
its Watch companion on the standard `macos-26` runner in the existing public mobile
snapshot repository. It never invokes EAS Build or starts a simulator/video stream.
It allows 60 minutes for Xcode compilation within a 90-minute job. Dependency caches
are reused; signed apps, certificates and provisioning profiles are never cached.

Required GitHub Actions secrets (values must never enter source or workflow inputs):

| Secret | Purpose |
| --- | --- |
| IOS_DISTRIBUTION_P12_BASE64 | Existing distribution certificate with private key |
| IOS_DISTRIBUTION_P12_PASSWORD | Certificate password |
| IOS_V3_PROFILE_BASE64 | Ad hoc profile for com.journeydeck.recorder.v3 |
| IOS_V3_WATCH_PROFILE_BASE64 | Matching .watchkitapp ad hoc profile |
| IOS_TEST_DEVICE_UDID | Registered iPhone identifier, used only for validation |
| IOS_ARTIFACT_PASSWORD | At least 32 cryptographically random characters |

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

Device validation starts at Ask JourneyDeck → Open Siri AI testing → Run 13-question
sample, followed by the complete 100-question suite. Then check real archive answers,
Siri invocation/replies, follow-ups, profile switching, locking during inference,
airplane mode, recording and marker controls, VoiceOver and large text. iPad native
layout acceptance remains separate. A passing JS suite is not a native build or
Apple Intelligence accuracy result.
