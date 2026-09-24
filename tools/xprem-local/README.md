# Local xprem control plane

This runs xprem on this computer. The dashboard and API bind to
`http://localhost:3000`; PostgreSQL has no host port. Docker volumes retain
the database and update files across restarts.

From this directory in PowerShell:

```powershell
.\setup.ps1
docker compose up -d
Invoke-WebRequest http://localhost:3000/hc -UseBasicParsing
```

To expose this instance through the configured Cloudflare Tunnel, start its
optional `public` profile:

```powershell
docker compose --profile public up -d
Invoke-WebRequest https://ota.journeydeck.me/hc -UseBasicParsing
```

The proxied `ota.journeydeck.me` DNS record points to this tunnel. The public
address works while this computer, Docker Desktop, xprem, and the tunnel are
running. The tunnel points to the xprem service inside Docker; it does not
require a router port forward. Keep the tunnel token in the ignored `.env`
file private.

Open `http://localhost:3000/dashboard`. The admin email and generated password
are in the gitignored `.env` file. Keep that file private and back it up with
the `xprem-db` and `xprem-updates` Docker volumes: the master key in `.env`
is required to decrypt app signing keys in the database.

The local dashboard contains a JourneyDeck app with `v3-preview` and
`production` channels, each mapped to a branch of the same name. Its app ID
and local publisher token are in `.env`; its public signing certificate is
saved as the ignored `certificate.pem` in this directory. The token has not
been used to publish an update.

Stop the services with `docker compose --profile public stop`; restart them with
`docker compose --profile public up -d`. Do not use `docker compose down -v`,
which removes the database and update files.

This local HTTP address is only for desktop setup and testing. The configured
`XPREM_BASE_URL` is `https://ota.journeydeck.me`. Build 38 embeds that HTTPS
manifest URL and the public signing certificate for runtime
`3.0.0-preview.6`. Build 36 and earlier installed builds continue using Expo
Updates; the guarded `ota:publish` command serves those builds. The guarded
`xprem:publish` command serves compatible V3 xprem builds. No xprem update has
been published.
