# DriveOS 3.0

> Architecture: DriveOS is being evolved incrementally as a modular monolith. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/MIGRATION-ROADMAP.md](docs/MIGRATION-ROADMAP.md).

DriveOS 3.0 adds two major local intelligence features on top of Drive Library Search.

## Favorite Routes

The Drives screen now automatically detects repeated routes.

DriveOS groups trips directionally when:

- both starting points are within about 0.75 miles, and
- both destinations are within about 0.75 miles.

If coordinates are unavailable, it falls back to normalized Tessie start/end address matching.

Favorite-route cards show:

- number of times driven
- average distance
- average duration
- average efficiency
- last driven date

Selecting **Show drives** filters the Drive Library to the exact trips in that route cluster.

## Music by Location

The Music screen can answer questions such as:

`Arlington`

or

`East Lamar`

Text search matches Tessie's starting and ending location strings. DriveOS then looks at music during the selected 10/15/30-minute window near the matching start or destination and summarizes:

- matching drives
- located plays
- unique tracks
- top tracks
- top artists
- recent matching plays

The calculation is completely local after the Drive Library is loaded; the search text is not sent to an external geocoder.

## Click the map for music

Every Drive Details map is now clickable.

Click a point on the map and DriveOS shows the actual GPS-located song starts within:

- 0.5 mile
- 1 mile
- 2 miles
- 5 miles

Selecting a result jumps to its numbered song marker.

## Hardening cleanup

DriveOS 3.0 also includes a cleanup pass:

- the Drive Library endpoint now really loads 365 days
- Spotify history is read once per library aggregation rather than once per drive
- internal Tessie history windows are range-validated
- no new network API surface was required for Favorite Routes or Music by Location
- all new user-visible location text is escaped before HTML rendering
- existing localhost session authentication, CSP, WebView2 restrictions, DPAPI credentials, and parent-process validation remain intact

## Update

Run the single-file updater:

`DriveOS-Update-2.0.cmd`

It preserves `.env`, `data`, and `update-backups`, compiles to a temporary verified EXE first, verifies file version `2.0.0.0`, swaps it over `DriveOS.exe`, refreshes the desktop shortcut, and launches DriveOS 3.0


## DriveOS 3.0
Major electric-glass UI redesign inspired by the DriveOS driving + music launch language. Light is the default appearance; Dark remains available.


## DriveOS 3.0.1
This build is intended for a fresh install on another Windows computer and includes the updated white Model 3 dashboard hero.


## DriveOS 3.0.3
UI polish: complete drive rows are clickable, the dashboard vehicle panel uses a structured responsive layout, and the white Model 3 hero has been redrawn with realistic sedan proportions.
