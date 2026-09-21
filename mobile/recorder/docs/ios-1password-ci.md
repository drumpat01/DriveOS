# 1Password CI for V3 registered-device builds

Key Master setup for `.github/workflows/ios-v3-device.yml`. Windows-first
(1Password for Windows or [1password.com](https://1password.com) in a browser).
No Mac is required to store secrets. This does not add a paid CI product.

Do **not** put `.p12` files, provisioning profiles, UDIDs, or
`IOS_ARTIFACT_PASSWORD` in the GitHub Secrets UI. The only GitHub secret this
workflow may use is `OP_SERVICE_ACCOUNT_TOKEN`. Values must never enter source,
workflow inputs, or chat logs.

## Vault and item

| | Exact name |
| --- | --- |
| Vault | `JourneyDeck-CI` |
| Item | `ios-v3-device` |

Create a dedicated vault named `JourneyDeck-CI`. Do not put these fields in a
Personal, Private, Employee, or default Shared vault — service accounts cannot
use those, and least privilege needs an isolated vault.

Create one item named `ios-v3-device`. Add **text** fields with these exact
names (they become the last segment of each `op://` reference):

| Field | What to store |
| --- | --- |
| `IOS_DISTRIBUTION_P12_BASE64` | Existing distribution certificate + private key, already Base64 text |
| `IOS_DISTRIBUTION_P12_PASSWORD` | Password for that `.p12` |
| `IOS_V3_PROFILE_BASE64` | **Ad hoc** profile for `com.journeydeck.recorder.v3`, already Base64 text |
| `IOS_V3_WATCH_PROFILE_BASE64` | Matching `.watchkitapp` **ad hoc** profile, already Base64 text |
| `IOS_TEST_DEVICE_UDID` | Registered iPhone UDID (validation only) |
| `IOS_ARTIFACT_PASSWORD` | At least 32 cryptographically random characters |

Workflow references (do not change the path segments):

```
op://JourneyDeck-CI/ios-v3-device/IOS_DISTRIBUTION_P12_BASE64
op://JourneyDeck-CI/ios-v3-device/IOS_DISTRIBUTION_P12_PASSWORD
op://JourneyDeck-CI/ios-v3-device/IOS_V3_PROFILE_BASE64
op://JourneyDeck-CI/ios-v3-device/IOS_V3_WATCH_PROFILE_BASE64
op://JourneyDeck-CI/ios-v3-device/IOS_TEST_DEVICE_UDID
op://JourneyDeck-CI/ios-v3-device/IOS_ARTIFACT_PASSWORD
```

## File blobs must be already-base64 text

Store `.p12` and `.mobileprovision` contents as **text fields that already
contain Base64**, not as 1Password file attachments. The workflow and
`prepare-ios-signing.py` decode `*_BASE64` environment variables with strict
Base64. A file attachment would resolve to raw bytes (or a filename), and
preflight/install would fail.

On Windows you can produce the text with PowerShell, then paste the single
line into the 1Password field:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\certificate.p12'))
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\app.mobileprovision'))
```

Do not commit those files or the Base64 strings.

## Ad hoc profiles only

`prepare-ios-signing.py` rejects anything that is not an **ad hoc**
distribution profile:

- It requires `ProvisionedDevices` (the registered iPhone must be listed).
- It rejects `ProvisionsAllDevices` (App Store / In-House enterprise).
- It rejects `get-task-allow` (development profiles).

An App Store or App Store Connect profile will fail the GitHub signing
preflight even if the certificate is valid. Export **Ad Hoc** profiles for
`com.journeydeck.recorder.v3` and `com.journeydeck.recorder.v3.watchkitapp`
from Apple's developer site (browser is enough; Xcode on a Mac is not
required for this storage step). Device-build context:
[ios-github-device-build.md](ios-github-device-build.md).

## Service account (least privilege)

On [1password.com](https://1password.com) create a service account for this
workflow only:

- Access **only** vault `JourneyDeck-CI`.
- Permission **`read_items` only**. Do not grant `write_items`,
  `share_items`, or “create vaults”.
- Do not grant Personal / Private / Employee / default Shared vaults.
- Store the issued token as GitHub Actions repository secret
  `OP_SERVICE_ACCOUNT_TOKEN`. That is the only GitHub secret this job
  should have for signing.

Vault access and permissions on a service account cannot be edited later;
create a new account if the scope is wrong. Revoke the old token.

## GitHub

In the repository Settings → Secrets and variables → Actions, keep a single
secret:

| GitHub secret | Value |
| --- | --- |
| `OP_SERVICE_ACCOUNT_TOKEN` | Service account token from 1Password |

Remove any leftover `IOS_*` GitHub secrets after the 1Password item is
populated and a successful native archive has used the new path. Do not
re-add certificate or profile blobs to GitHub.

1Password load runs only when the fingerprint (or `force_native`) decides a
native archive is required. JS-only skips do not call 1Password.

## OIDC later (optional)

This workflow authenticates with the service-account token. 1Password
Workload Identity / OIDC can replace that token later so GitHub no longer
stores `OP_SERVICE_ACCOUNT_TOKEN`. That is optional follow-up: it needs a
1Password environment scoped to these same variables, plus
`id-token: write`. Do not add it in this change. Do not add 1Password
Connect or another paid host.

## Out of scope

- No TestFlight or App Store submit from this workflow.
- No EAS Build and no change to `runtimeVersion` policy.
- No re-dispatch as part of wiring secrets.
