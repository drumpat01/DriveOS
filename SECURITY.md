# DriveOS 1.0 Security Notes

DriveOS is a personal localhost application. Version 1.0 adds defense-in-depth around the local API, embedded browser, credentials, and lifecycle.

## Local API isolation

The backend:

- binds only to `127.0.0.1`
- rejects non-loopback clients
- requires the exact `127.0.0.1:8787` Host header
- requires a fresh random 256-bit `X-DriveOS-Session` credential on every request
- receives that credential only from the owning `DriveOS.exe` process environment
- never writes the session credential to disk
- rejects duplicate security-sensitive HTTP headers
- rejects transfer-encoded requests
- limits request-line, header, and body sizes
- accepts only GET and POST
- requires JSON for POST operations
- has read/write timeouts
- canonicalizes static-file paths before serving files

The WebView2 host inserts the session header itself. The credential is not placed in the page DOM or JavaScript.

## Desktop process lifecycle

The backend validates both:

- the parent DriveOS process ID
- the parent process start timestamp

This reduces the risk of a stale backend surviving PID reuse.

Closing DriveOS explicitly terminates the hidden backend. The backend also independently exits if its validated parent process disappears.

DriveOS also uses a Windows mutex so only one desktop instance runs at a time.

## Credential protection

Long-lived DriveOS secrets remain protected with Windows DPAPI.

`data\driveos-secrets.json` contains DPAPI-encrypted values, not plaintext Tessie or Spotify credentials.

The setup script also attempts to restrict the file ACL to:

- the current Windows user
- Local SYSTEM

Spotify OAuth tokens are DPAPI encrypted as well, and the authorization script applies the same file ACL hardening.

## Embedded browser restrictions

DriveOS WebView2:

- disables DevTools
- disables default context menus
- disables browser accelerator keys
- disables host objects and web messaging
- denies browser permission requests
- cancels in-app downloads
- blocks TLS certificate errors
- prevents navigation away from the DriveOS localhost origin
- allows external browser launches only for HTTPS Spotify and X URLs

## HTTP response protections

DriveOS sends:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- a restrictive Content Security Policy

## Error handling

Detailed backend errors are written only to local log files and known credentials are redacted before logging.

The web UI receives generic server-error messages rather than raw upstream exception details.

## Third-party dependencies

DriveOS 1.0 pins the Microsoft WebView2 SDK version used by its local build process.

The installer validates the native WebView2 loader's Microsoft Authenticode signature before building DriveOS.exe.

MapLibre GL JS remains pinned to version 5.24.0 in the web UI.

## Threat model

These protections are intended to keep a personal localhost application from being casually reachable or manipulated by unrelated web pages and to avoid exposing credentials in browser code or plaintext files.

They are not a sandbox against malicious software already executing as the same Windows user. Software running under the same account can generally inspect that user's processes and files.


## Spotify artwork proxy (1.1)

DriveOS 1.1 proxies album artwork through its authenticated localhost API instead of requiring the embedded browser to fetch it directly.

The proxy accepts only Spotify-style alphanumeric track IDs. The remote image URL is obtained from Spotify's authenticated track metadata endpoint and is accepted only when it uses HTTPS and an `scdn.co` host. This prevents the artwork endpoint from becoming a general-purpose URL fetcher.


## Artwork loading (1.2)

DriveOS continues to proxy Spotify artwork rather than exposing a generic remote-image fetch endpoint.

Artwork URLs are sourced only from authenticated Spotify responses or previously archived Spotify history and are accepted only when they use HTTPS on an `scdn.co` host. Track IDs must match the Spotify-style alphanumeric validation used by the artwork route.


## DriveOS 2.0 hardening cleanup

Version 2.0 keeps both new features in the local UI layer wherever possible. Favorite-route detection and text-based Music by Location are computed from the already-authenticated Drive Library response, so no new network-facing API endpoints or third-party services were added.

Hardening/performance changes:

- The Drive Library API now explicitly returns a 365-day window instead of relying on a client-side fallback value.
- Tessie drive-history requests are capped at 1,000 records and `Days` parameters are validated to 1–730 days.
- Spotify history is loaded once per Drive Library aggregation rather than reread once per drive.
- Favorite Routes uses only coordinates and Tessie location strings already returned to the authenticated local app.
- Favorite-route coordinate clustering rejects non-numeric coordinates and falls back to normalized exact Tessie address matching.
- Music by Location text searches remain local and do not send location-search terms to Tessie, Spotify, OpenFreeMap, or another geocoder.
- Map-click music lookup operates only on GPS song markers already loaded for the selected drive.
- All new user-controlled text is rendered through the existing HTML escaping helper before insertion into HTML templates.
- No new WebView2 permissions, remote hosts, CSP exceptions, downloads, or localhost API routes were introduced.
