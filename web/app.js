const $ = (id) => document.getElementById(id);

const state = {
  drives: [],
  driveLibraryWindowDays: 365,
  favoriteRoutes: [],
  routeFilterDriveIds: null,
  routeFilterLabel: "",
  selectedDrive: null,
  playlistScope: false,
  driveMap: null,
  driveMapData: null,
  songMapMarkers: new Map(),
  replayMarker: null,
  replayMarkerElement: null,
  replayPlaying: false,
  replayAnimationFrame: null,
  replayStartWallTime: null,
  replayStartDriveMs: 0,
  replayCurrentDriveMs: 0,
  replayLastSongIndex: null,
  mapMusicPoint: null,
  mapMusicMarker: null,
  spotifyAuthorized: false,
  spotifyConnecting: false,
  placeCandidates: [],
  chargingSessions: [],
  recaps: []
};

const DRIVEOS_WEB_BUILD = window.DriveOSBuild.webBuild;
window.DRIVEOS_WEB_BUILD = DRIVEOS_WEB_BUILD;
document.documentElement.dataset.webBuild = DRIVEOS_WEB_BUILD;


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function songArtworkUrl(song) {
  if (song?.trackId) {
    return `/api/spotify/artwork/${encodeURIComponent(song.trackId)}`;
  }

  return song?.albumImage || "";
}

function songArtworkMarkup(song, className = "song-list-artwork") {
  const source = songArtworkUrl(song);
  const fallback = `<div class="${className} song-artwork-placeholder" aria-hidden="true">\u266B</div>`;

  if (!source) return fallback;

  return `
    <div class="${className} song-artwork-shell">
      <img
        class="song-artwork-image"
        src="${escapeHtml(source)}"
        alt="${escapeHtml(`${song.album || song.track || "Album"} artwork`)}"
        loading="lazy"
        onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
      <div class="song-artwork-placeholder" hidden aria-hidden="true">\u266B</div>
    </div>`;
}


function setText(id, value, fallback = "--") {
  const el = $(id);
  if (el) el.textContent = value ?? fallback;
}

async function getJson(path) {
  return window.DriveOSApi.get(path);
}

async function postJson(path, body) {
  return window.DriveOSApi.post(path, body);
}



function isTailnetRemote() {
  return /\.ts\.net$/i.test(location.hostname);
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
}


function initializeMobileNavigationPortal() {
  const nav = document.querySelector(".main-nav");
  const topbar = document.querySelector(".topbar");
  const topbarRight = document.querySelector(".topbar-right");

  if (!nav || !topbar) return;

  const updatePlacement = () => {
    const mobile = window.matchMedia("(max-width: 760px)").matches;

    if (mobile) {
      if (nav.parentElement !== document.body) {
        document.body.appendChild(nav);
      }
      nav.classList.add("mobile-nav-portal");
      return;
    }

    if (nav.parentElement === document.body) {
      if (topbarRight && topbarRight.parentElement === topbar) {
        topbar.insertBefore(nav, topbarRight);
      } else {
        topbar.appendChild(nav);
      }
    }

    nav.classList.remove("mobile-nav-portal");
  };

  updatePlacement();
  window.addEventListener("resize", updatePlacement, { passive: true });
}


async function purgeOldDriveOSCaches() {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith("driveos-shell-") && name !== "driveos-shell-3.2.0")
        .map(name => caches.delete(name))
    );
  } catch {}
}

function initializePwa() {
  // Avoid service-worker caching inside the desktop WebView. PWA caching is
  // only needed when DriveOS is opened through its private Tailscale URL.
  if (isTailnetRemote() && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js?v=3.2.0", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }, { once: true });
  }

  const banner = $("pwaInstallBanner");
  const dismiss = $("pwaInstallDismiss");
  const dismissed = localStorage.getItem("driveos-pwa-install-dismissed") === "1";

  if (banner && isTailnetRemote() && isIosDevice() && !isStandalonePwa() && !dismissed) {
    banner.hidden = false;
  }

  dismiss?.addEventListener("click", () => {
    localStorage.setItem("driveos-pwa-install-dismissed", "1");
    if (banner) banner.hidden = true;
  });

  document.documentElement.classList.toggle("remote-tailnet", isTailnetRemote());
  document.documentElement.classList.toggle("standalone-pwa", isStandalonePwa());
}


function updateClock() {
  $("dateTime").textContent = new Date().toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function showView(name) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active-view", view.id === `view-${name}`);
  });

  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-button").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("[data-go-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.goView));
});

bindDriveLibrarySearch();
bindMusicLocationSearch();
$("saveElectricityRate")?.addEventListener("click", saveChargingRate);

async function loadStatus() {
  try {
    const status = await getJson("/api/status");
    state.playlistScope = Boolean(status.playlistScope);

    $("connectionPill").classList.remove("bad");
    $("connectionPill").classList.add("ok");
    setText("connectionText", isTailnetRemote() ? "Tailscale" : "Connected");

    setText("driveOSStatus", "ONLINE");
    $("driveOSStatus").className = "ok-text";

    setText("tessieStatus", status.tessie ? "CONNECTED" : "ERROR");
    $("tessieStatus").className = status.tessie ? "ok-text" : "bad-text";

    state.spotifyAuthorized = Boolean(status.spotify);
    setText("spotifyStatus", status.spotify ? "CONNECTED" : "CONNECT");
    $("spotifyStatus").className = status.spotify ? "ok-text" : "warn-text";

    const spotifyConnectButton = $("spotifyConnectButton");
    if (spotifyConnectButton) {
      spotifyConnectButton.hidden = Boolean(status.spotify);
    }

    setText("playlistStatus", status.playlistScope ? "READY" : "REAUTHORIZE");
    $("playlistStatus").className = status.playlistScope ? "ok-text" : "warn-text";
  } catch (error) {
    $("connectionPill").classList.remove("ok");
    $("connectionPill").classList.add("bad");
    setText("connectionText", "Backend error");
    setText("driveOSStatus", "ERROR");
    $("driveOSStatus").className = "bad-text";
  }
}

async function loadVehicle() {
  try {
    const v = await getJson("/api/vehicle");

    setText("vehicleName", v.name);
    setText("vehicleState", v.state);
    setText("batteryValue", v.battery);
    setText("rangeMiles", v.rangeMiles);
    setText("chargeLimit", v.chargeLimit);
    setText("chargingState", v.charging);
    setText("insideTemp", v.insideTempF);
    setText("outsideTemp", v.outsideTempF);

    const battery = Number(v.battery);
    $("batteryFill").style.width =
      Number.isFinite(battery) ? `${Math.max(0, Math.min(100, battery))}%` : "0%";

    $("vehicleRefresh").textContent =
      `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch (error) {
    $("vehicleRefresh").textContent = `Tesla error: ${error.message}`;
  }
}

async function loadSpotify() {
  const list = $("trackList");

  try {
    const data = await getJson("/api/spotify/recent");
    const tracks = data.recent || [];

    if (tracks.length) {
      const featured = tracks[0];
      const recent = tracks.slice(1, 5);

      list.innerHTML = `
        <div class="v3-now-playing">
          <div class="v3-featured-art">
            ${songArtworkMarkup(featured, "track-artwork v3-featured-artwork")}
            <span class="v3-art-glow"></span>
          </div>

          <div class="v3-featured-copy">
            <div class="v3-spotify-kicker">
              <span class="v3-spotify-dot"></span>
              Spotify \u00B7 latest archived play
            </div>
            <div class="v3-featured-title">${escapeHtml(featured.track)}</div>
            <div class="v3-featured-artist">${escapeHtml(featured.artist)}</div>
            <div class="v3-waveform" aria-hidden="true">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <div class="v3-featured-time">${escapeHtml(featured.time)}</div>
          </div>

          <div class="v3-recent-list">
            <div class="v3-recent-heading">Recently played</div>
            ${recent.map(track => `
              <div class="v3-recent-track">
                ${songArtworkMarkup(track, "track-artwork v3-recent-artwork")}
                <div class="v3-recent-copy">
                  <strong>${escapeHtml(track.track)}</strong>
                  <span>${escapeHtml(track.artist)}</span>
                </div>
                <span class="v3-recent-time">${escapeHtml(track.time)}</span>
              </div>
            `).join("")}
          </div>
        </div>`;
    } else {
      list.innerHTML = `<div class="empty-state"><h3>No recent plays</h3><p>Play something in Spotify and refresh.</p></div>`;
    }

    state.spotifyAuthorized = true;
    const spotifyConnectButton = $("spotifyConnectButton");
    if (spotifyConnectButton) spotifyConnectButton.hidden = true;

    setText("archiveTotal", data.archiveTotal, "0");
    setText(
      "archiveAdded",
      Number(data.newlyArchived) > 0
        ? `Recovered ${data.newlyArchived} recent play${Number(data.newlyArchived) === 1 ? "" : "s"} from Spotify`
        : "Spotify archive up to date"
    );

    return data;
  } catch (error) {
    state.spotifyAuthorized = false;
    const spotifyConnectButton = $("spotifyConnectButton");
    if (spotifyConnectButton) spotifyConnectButton.hidden = false;
    list.innerHTML = `<div class="empty-state"><h3>Connect Spotify</h3><p>Authorize Spotify on this computer, then DriveOS will recover the recent listening history Spotify still exposes.</p></div>`;
    setText("archiveAdded", "Spotify authorization required");
    return null;
  }
}

function batteryText(drive) {
  if (drive.startingBattery == null || drive.endingBattery == null) return "--";
  return `${drive.startingBattery}% \u2192 ${drive.endingBattery}%`;
}


function compactLocation(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const parts = text
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) return text;

  return `${parts[0]}, ${parts[1]}`;
}

function driveRouteText(drive) {
  const origin = compactLocation(drive.startingLocation);
  const destination = compactLocation(drive.endingLocation);

  if (origin && destination) return `${origin} \u2192 ${destination}`;
  if (destination) return `\u2192 ${destination}`;
  if (origin) return `${origin} \u2192`;
  return "";
}

function driveSearchHaystack(drive) {
  const soundtrack = drive.soundtrack || [];
  const songText = soundtrack.flatMap(song => [
    song.track,
    song.artist,
    song.album
  ]);

  return [
    drive.id,
    drive.dateLabel,
    drive.shortDateLabel,
    drive.dateIso,
    drive.dateNumeric,
    drive.startedAt,
    drive.endedAt,
    drive.startTime,
    drive.endTime,
    drive.startingLocation,
    drive.endingLocation,
    drive.rawStartingLocation,
    drive.rawEndingLocation,
    drive.tessieTag,
    drive.driverProfile,
    drive.miles,
    `${drive.miles ?? ""} miles`,
    drive.durationMinutes,
    `${drive.durationMinutes ?? ""} minutes`,
    drive.startingBattery,
    drive.endingBattery,
    drive.batteryUsed,
    drive.energyKWh,
    drive.efficiencyWhMi,
    drive.averageSpeed,
    drive.maxSpeed,
    ...songText
  ]
    .filter(value => value !== null && value !== undefined)
    .join(" ")
    .toLocaleLowerCase();
}

function numericFilterValue(id) {
  const raw = $(id)?.value?.trim();

  if (!raw) return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function degreesToRadians(value) {
  return Number(value) * Math.PI / 180;
}

function geoDistanceMiles(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);

  if (!values.every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  const [aLat, aLon, bLat, bLon] = values;
  const earthMiles = 3958.7613;
  const dLat = degreesToRadians(bLat - aLat);
  const dLon = degreesToRadians(bLon - aLon);
  const lat1Rad = degreesToRadians(aLat);
  const lat2Rad = degreesToRadians(bLat);

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;

  return 2 * earthMiles * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizedLocationText(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function routeAddressesMatch(a, b) {
  return normalizedLocationText(a) &&
    normalizedLocationText(a) === normalizedLocationText(b);
}

function driveFitsRouteCluster(drive, cluster) {
  const hasCoordinates = [
    drive.startingLatitude,
    drive.startingLongitude,
    drive.endingLatitude,
    drive.endingLongitude,
    cluster.startingLatitude,
    cluster.startingLongitude,
    cluster.endingLatitude,
    cluster.endingLongitude
  ].map(Number).every(Number.isFinite);

  if (hasCoordinates) {
    return geoDistanceMiles(
      drive.startingLatitude,
      drive.startingLongitude,
      cluster.startingLatitude,
      cluster.startingLongitude
    ) <= 0.75 && geoDistanceMiles(
      drive.endingLatitude,
      drive.endingLongitude,
      cluster.endingLatitude,
      cluster.endingLongitude
    ) <= 0.75;
  }

  return routeAddressesMatch(drive.startingLocation, cluster.startingLocation) &&
    routeAddressesMatch(drive.endingLocation, cluster.endingLocation);
}

function detectFavoriteRoutes(drives) {
  const clusters = [];

  [...drives]
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .forEach(drive => {
      if (!drive.startingLocation && !drive.endingLocation) return;

      let cluster = clusters.find(candidate => driveFitsRouteCluster(drive, candidate));

      if (!cluster) {
        cluster = {
          startingLocation: drive.startingLocation || "Unknown start",
          endingLocation: drive.endingLocation || "Unknown destination",
          startingLatitude: drive.startingLatitude,
          startingLongitude: drive.startingLongitude,
          endingLatitude: drive.endingLatitude,
          endingLongitude: drive.endingLongitude,
          drives: []
        };
        clusters.push(cluster);
      }

      cluster.drives.push(drive);
    });

  return clusters
    .filter(cluster => cluster.drives.length >= 2)
    .map((cluster, index) => {
      const distances = cluster.drives
        .map(drive => Number(drive.miles))
        .filter(Number.isFinite);
      const durations = cluster.drives
        .map(drive => Number(drive.durationMinutes))
        .filter(Number.isFinite);
      const efficiencies = cluster.drives
        .map(drive => Number(drive.efficiencyWhMi))
        .filter(Number.isFinite);

      const average = values => values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;

      return {
        id: `route-${index + 1}`,
        startingLocation: cluster.startingLocation,
        endingLocation: cluster.endingLocation,
        count: cluster.drives.length,
        driveIds: cluster.drives.map(drive => drive.id),
        lastDrivenAt: cluster.drives[0]?.startedAt || null,
        lastDrivenLabel: cluster.drives[0]?.shortDateLabel || "",
        averageMiles: average(distances),
        averageMinutes: average(durations),
        averageWhMi: average(efficiencies)
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(b.lastDrivenAt).localeCompare(String(a.lastDrivenAt));
    })
    .slice(0, 12);
}

function clearFavoriteRouteFilter(render = true) {
  state.routeFilterDriveIds = null;
  state.routeFilterLabel = "";

  const bar = $("driveRouteFilterBar");
  if (bar) bar.hidden = true;

  if (render) renderDriveLibrary();
}

function applyFavoriteRouteFilter(route) {
  state.routeFilterDriveIds = new Set(route.driveIds || []);
  state.routeFilterLabel = `${compactLocation(route.startingLocation)} \u2192 ${compactLocation(route.endingLocation)}`;

  const bar = $("driveRouteFilterBar");
  const label = $("driveRouteFilterLabel");

  if (label) label.textContent = state.routeFilterLabel;
  if (bar) bar.hidden = false;

  renderDriveLibrary();
  $("allDrives")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFavoriteRoutes() {
  const container = $("favoriteRoutes");
  const status = $("favoriteRoutesStatus");
  if (!container) return;

  state.favoriteRoutes = detectFavoriteRoutes(state.drives);

  if (status) {
    status.textContent = state.favoriteRoutes.length
      ? `${state.favoriteRoutes.length} repeated route${state.favoriteRoutes.length === 1 ? "" : "s"}`
      : "No repeated routes yet";
  }

  if (!state.favoriteRoutes.length) {
    container.innerHTML = `
      <div class="favorite-routes-empty">
        <strong>No repeated routes detected yet</strong>
        <span>DriveOS groups trips when both endpoints are within about 0.75 miles, or their Tessie addresses match.</span>
      </div>`;
    return;
  }

  container.innerHTML = state.favoriteRoutes.map((route, index) => {
    const avgMiles = Number.isFinite(route.averageMiles) ? `${route.averageMiles.toFixed(1)} mi avg` : "Distance varies";
    const avgMinutes = Number.isFinite(route.averageMinutes) ? `${Math.round(route.averageMinutes)} min avg` : "Duration varies";
    const efficiency = Number.isFinite(route.averageWhMi) ? `${Math.round(route.averageWhMi)} Wh/mi` : "Efficiency --";

    return `
      <article class="favorite-route-card">
        <div class="favorite-route-rank">${index + 1}</div>
        <div class="favorite-route-copy">
          <strong>${escapeHtml(compactLocation(route.startingLocation) || "Unknown start")}</strong>
          <span class="favorite-route-arrow">\u2192</span>
          <strong>${escapeHtml(compactLocation(route.endingLocation) || "Unknown destination")}</strong>
          <div class="favorite-route-meta">
            ${route.count} drives \u00B7 ${escapeHtml(avgMiles)} \u00B7 ${escapeHtml(avgMinutes)} \u00B7 ${escapeHtml(efficiency)}
          </div>
          <div class="favorite-route-last">Last driven ${escapeHtml(route.lastDrivenLabel || "recently")}</div>
        </div>
        <button class="secondary-button favorite-route-button" type="button" data-favorite-route="${escapeHtml(route.id)}">Show drives</button>
      </article>`;
  }).join("");

  container.querySelectorAll("[data-favorite-route]").forEach(button => {
    button.addEventListener("click", () => {
      const route = state.favoriteRoutes.find(item => item.id === button.dataset.favoriteRoute);
      if (route) applyFavoriteRouteFilter(route);
    });
  });
}

function filteredDriveLibrary() {
  const query = $("driveSearchInput")?.value?.trim().toLocaleLowerCase() || "";
  const terms = query.split(/\s+/).filter(Boolean);
  const from = $("driveDateFrom")?.value || "";
  const to = $("driveDateTo")?.value || "";
  const minMiles = numericFilterValue("driveMinMiles");
  const maxMiles = numericFilterValue("driveMaxMiles");
  const music = $("driveMusicFilter")?.value || "any";
  const sort = $("driveSort")?.value || "newest";

  const filtered = state.drives.filter(drive => {
    if (state.routeFilterDriveIds && !state.routeFilterDriveIds.has(drive.id)) {
      return false;
    }

    const haystack = driveSearchHaystack(drive);

    if (terms.length && !terms.every(term => haystack.includes(term))) {
      return false;
    }

    const driveDate = drive.dateIso || String(drive.startedAt || "").slice(0, 10);

    if (from && driveDate && driveDate < from) return false;
    if (to && driveDate && driveDate > to) return false;

    const miles = Number(drive.miles);

    if (minMiles !== null && (!Number.isFinite(miles) || miles < minMiles)) {
      return false;
    }

    if (maxMiles !== null && (!Number.isFinite(miles) || miles > maxMiles)) {
      return false;
    }

    if (music === "with" && Number(drive.songCount || 0) === 0) return false;
    if (music === "without" && Number(drive.songCount || 0) > 0) return false;

    return true;
  });

  const valueOr = (drive, field, fallback) => {
    const value = Number(drive[field]);
    return Number.isFinite(value) ? value : fallback;
  };

  filtered.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return String(a.startedAt).localeCompare(String(b.startedAt));
      case "distance-desc":
        return valueOr(b, "miles", -1) - valueOr(a, "miles", -1);
      case "distance-asc":
        return valueOr(a, "miles", Number.POSITIVE_INFINITY) -
               valueOr(b, "miles", Number.POSITIVE_INFINITY);
      case "duration-desc":
        return valueOr(b, "durationMinutes", -1) -
               valueOr(a, "durationMinutes", -1);
      case "efficiency-asc":
        return valueOr(a, "efficiencyWhMi", Number.POSITIVE_INFINITY) -
               valueOr(b, "efficiencyWhMi", Number.POSITIVE_INFINITY);
      case "newest":
      default:
        return String(b.startedAt).localeCompare(String(a.startedAt));
    }
  });

  return filtered;
}

function renderDriveLibrary() {
  const container = $("allDrives");
  if (!container) return;

  const drives = filteredDriveLibrary();
  const count = $("driveSearchCount");

  if (count) {
    const windowText = state.driveLibraryWindowDays
      ? ` \u00B7 ${state.driveLibraryWindowDays}-day library`
      : "";

    const routeText = state.routeFilterDriveIds ? " \u00B7 favorite route" : "";

    count.textContent =
      `${drives.length} of ${state.drives.length} drive${state.drives.length === 1 ? "" : "s"}${windowText}${routeText}`;
  }

  if (!state.drives.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-mark">\u2197</div>
        <h3>No Tessie drives yet</h3>
        <p>Your next completed drive will appear here automatically.</p>
      </div>`;
    return;
  }

  if (!drives.length) {
    container.innerHTML = `
      <div class="empty-state drive-search-empty">
        <div class="empty-mark">\u2315</div>
        <h3>No drives match these filters</h3>
        <p>Try a different destination, song, artist, date, or distance range.</p>
        <button id="driveEmptyReset" class="secondary-button" type="button">Reset filters</button>
      </div>`;

    $("driveEmptyReset")?.addEventListener("click", resetDriveFilters);
    return;
  }

  container.innerHTML = drives.map(drive => driveCard(drive)).join("");
  bindDriveButtons(container);
}

function resetDriveFilters() {
  clearFavoriteRouteFilter(false);
  if ($("driveSearchInput")) $("driveSearchInput").value = "";
  if ($("driveDateFrom")) $("driveDateFrom").value = "";
  if ($("driveDateTo")) $("driveDateTo").value = "";
  if ($("driveMinMiles")) $("driveMinMiles").value = "";
  if ($("driveMaxMiles")) $("driveMaxMiles").value = "";
  if ($("driveMusicFilter")) $("driveMusicFilter").value = "any";
  if ($("driveSort")) $("driveSort").value = "newest";

  renderDriveLibrary();
}

function bindDriveLibrarySearch() {
  const liveInputs = [
    "driveSearchInput",
    "driveDateFrom",
    "driveDateTo",
    "driveMinMiles",
    "driveMaxMiles"
  ];

  liveInputs.forEach(id => {
    $(id)?.addEventListener("input", renderDriveLibrary);
    $(id)?.addEventListener("change", renderDriveLibrary);
  });

  $("driveMusicFilter")?.addEventListener("change", renderDriveLibrary);
  $("driveSort")?.addEventListener("change", renderDriveLibrary);

  $("driveSearchClear")?.addEventListener("click", () => {
    if ($("driveSearchInput")) {
      $("driveSearchInput").value = "";
      $("driveSearchInput").focus();
    }

    renderDriveLibrary();
  });

  $("driveFiltersClear")?.addEventListener("click", resetDriveFilters);
  $("driveRouteFilterClear")?.addEventListener("click", () => clearFavoriteRouteFilter());
}


function cityFromLocation(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parts = raw
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);

  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];

  const countryPattern = /^(united states(?: of america)?|usa|u\.s\.a\.?|us)$/i;
  if (countryPattern.test(parts[parts.length - 1])) {
    parts.pop();
  }

  if (parts.length === 1) return parts[0];

  // Typical Tessie address:
  // street, city, state ZIP, country
  // After removing the country, the city is the second-to-last component.
  return parts[Math.max(0, parts.length - 2)];
}

function driveCard(drive, compact = false) {
  const route = driveRouteText(drive);
  const startLocation = String(drive.startingLocation || "").trim();
  const endLocation = String(drive.endingLocation || "").trim();

  const startCity = cityFromLocation(startLocation);
  const endCity = cityFromLocation(endLocation);

  const dashboardRoute = compact && (startCity || endCity)
    ? `
      <div class="dashboard-route-cities" aria-label="Drive route">
        <span class="dashboard-route-city">${escapeHtml(startCity || "Unknown")}</span>
        <span class="dashboard-route-city-arrow" aria-hidden="true">\u2192</span>
        <span class="dashboard-route-city">${escapeHtml(endCity || "Unknown")}</span>
      </div>`
    : "";

  return `
    <article class="drive-card${compact ? " dashboard-drive-card" : ""}" data-drive-card-id="${escapeHtml(drive.id)}" tabindex="0" role="button" aria-label="Open drive details">
      <div class="drive-main">
        <div class="drive-main-heading">
          <strong>${escapeHtml(compact ? drive.shortDateLabel : drive.dateLabel)}</strong>
          <span>${escapeHtml(drive.startTime)} \u2192 ${escapeHtml(drive.endTime)}</span>
        </div>

        ${dashboardRoute}

        ${!compact && route ? `
          <div class="drive-route"
               title="${escapeHtml(`${startLocation} \u2192 ${endLocation}`)}">
            ${escapeHtml(route)}
          </div>` : ""}

        ${drive.tessieTag ? `<div class="drive-tag">${escapeHtml(drive.tessieTag)}</div>` : ""}
      </div>
      <div class="drive-stat"><span>Distance</span><strong>${drive.miles ?? "--"} mi</strong></div>
      <div class="drive-stat"><span>Duration</span><strong>${drive.durationMinutes ?? "--"} min</strong></div>
      <div class="drive-stat dashboard-secondary-stat"><span>Battery</span><strong>${escapeHtml(batteryText(drive))}</strong></div>
      <div class="drive-stat dashboard-secondary-stat"><span>Soundtrack</span><strong>${drive.songCount ?? 0} songs</strong></div>
      ${compact ? `<button class="view-drive-button v3-drive-play" type="button" data-drive-id="${escapeHtml(drive.id)}" aria-label="Open drive">\u25B6</button>`
                : `<div class="drive-stat"><span>Energy</span><strong>${drive.energyKWh ?? "--"} kWh</strong></div>
                   <button class="view-drive-button" type="button" data-drive-id="${escapeHtml(drive.id)}">View drive</button>`}
    </article>`;
}

function bindDriveButtons(container) {
  const openById = driveId => {
    const drive = state.drives.find(d => d.id === driveId);
    if (drive) openDriveModal(drive);
  };

  container.querySelectorAll("[data-drive-card-id]").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      openById(card.dataset.driveCardId);
    });

    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openById(card.dataset.driveCardId);
    });
  });

  container.querySelectorAll("[data-drive-id]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      openById(button.dataset.driveId);
    });
  });
}


function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "--";
}

function locationDisplay(location, rawLocation) {
  if (!location) return rawLocation || "Unknown location";
  if (rawLocation && location !== rawLocation) return `${location} \u00B7 ${rawLocation}`;
  return location;
}

async function savePlaceAlias(location, label) {
  await postJson("/api/places/alias", { location, label });
  await Promise.allSettled([loadPlaces(), loadDrives(), loadCharging(), loadRecaps()]);
}

function renderPlaces() {
  const container = $("placeNamesList");
  const status = $("placeNamesStatus");
  if (!container) return;

  const places = state.placeCandidates || [];
  if (status) status.textContent = `${places.length} repeated locations`;

  if (!places.length) {
    container.innerHTML = `<div class="empty-state"><p>No repeated Tessie locations are available yet.</p></div>`;
    return;
  }

  container.innerHTML = places.slice(0, 18).map((place, index) => `
    <div class="place-name-row">
      <div class="place-name-copy">
        <strong>${escapeHtml(place.label || compactLocation(place.location) || "Location")}</strong>
        <span>${escapeHtml(place.location)}</span>
        <small>${place.uses} drive endpoint${place.uses === 1 ? "" : "s"}</small>
      </div>
      <div class="place-name-edit">
        <input data-place-label="${index}" type="text" maxlength="64" value="${escapeHtml(place.label || "")}" placeholder="Name this place" aria-label="Friendly name for ${escapeHtml(place.location)}">
        <button class="secondary-button" data-place-save="${index}" type="button">${place.label ? "Update" : "Save"}</button>
        ${place.label ? `<button class="text-button" data-place-remove="${index}" type="button">Remove</button>` : ""}
      </div>
    </div>`).join("");

  container.querySelectorAll("[data-place-save]").forEach(button => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.placeSave);
      const place = places[index];
      const input = container.querySelector(`[data-place-label="${index}"]`);
      if (!place || !input) return;
      button.disabled = true;
      try { await savePlaceAlias(place.location, input.value.trim()); }
      catch (error) { if (status) status.textContent = error.message; }
      finally { button.disabled = false; }
    });
  });

  container.querySelectorAll("[data-place-remove]").forEach(button => {
    button.addEventListener("click", async () => {
      const place = places[Number(button.dataset.placeRemove)];
      if (!place) return;
      await savePlaceAlias(place.location, "");
    });
  });
}

async function loadPlaces() {
  try {
    const data = await getJson("/api/places");
    state.placeCandidates = data.places || [];
    renderPlaces();
  } catch (error) {
    const status = $("placeNamesStatus");
    if (status) status.textContent = error.message;
  }
}

function renderCharging(data) {
  const summary = data.summary30 || {};
  setText("charge30Sessions", summary.sessions ?? 0, "0");
  setText("charge30Energy", summary.energyAddedKWh ?? 0, "0");
  setText("charge30Cost", summary.cost == null ? "--" : money(summary.cost), "--");
  setText("charge30Superchargers", summary.superchargerSessions ?? 0, "0");

  const rate = data.settings?.electricityRateCents;
  const rateInput = $("electricityRateInput");
  if (rateInput && document.activeElement !== rateInput) rateInput.value = rate == null ? "" : rate;

  const container = $("chargingHistory");
  if (!container) return;
  const sessions = state.chargingSessions || [];

  if (!sessions.length) {
    container.innerHTML = `<div class="empty-state"><h3>No charging sessions yet</h3><p>Tessie charging history will appear here.</p></div>`;
    return;
  }

  container.innerHTML = sessions.slice(0, 30).map(session => `
    <article class="charge-session-card">
      <div class="charge-session-main">
        <div><strong>${escapeHtml(session.location || "Unknown location")}</strong><span>${escapeHtml(session.dateLabel)} \u00B7 ${escapeHtml(session.startTime)} \u2192 ${escapeHtml(session.endTime)}</span></div>
        <span class="charge-kind ${session.isSupercharger ? "supercharger" : ""}">${session.isSupercharger ? "Supercharger" : "Charging"}</span>
      </div>
      <div class="charge-session-metrics">
        <div><span>Energy</span><strong>${session.energyAddedKWh ?? "--"} kWh</strong></div>
        <div><span>Battery</span><strong>${session.startingBattery ?? "--"}% \u2192 ${session.endingBattery ?? "--"}%</strong></div>
        <div><span>Miles added</span><strong>${session.milesAdded ?? "--"} mi</strong></div>
        <div><span>Cost</span><strong>${session.displayCost == null ? "--" : money(session.displayCost)}</strong><small>${session.costType === "estimated" ? "estimated" : session.costType === "recorded" ? "recorded" : ""}</small></div>
      </div>
    </article>`).join("");
}

async function loadCharging() {
  try {
    const data = await getJson("/api/charging");
    state.chargingSessions = data.sessions || [];
    renderCharging(data);
  } catch (error) {
    const container = $("chargingHistory");
    if (container) container.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function saveChargingRate() {
  const input = $("electricityRateInput");
  const button = $("saveElectricityRate");
  if (!input || !button) return;
  button.disabled = true;
  try {
    const raw = input.value.trim();
    await postJson("/api/charging/settings", { electricityRateCents: raw === "" ? null : Number(raw) });
    await Promise.allSettled([loadCharging(), loadRecaps()]);
  } finally {
    button.disabled = false;
  }
}

function renderMonthlyRecap() {
  const container = $("monthlyRecap");
  const select = $("recapMonthSelect");
  if (!container || !select) return;

  const recap = state.recaps.find(item => item.monthKey === select.value) || state.recaps[0];
  if (!recap) {
    container.innerHTML = `<div class="empty-state"><p>No monthly recap data yet.</p></div>`;
    return;
  }

  const route = recap.favoriteRoute ? recap.favoriteRoute.replace(" -> ", " \u2192 ") : "Not enough drives";
  container.innerHTML = `
    <div class="recap-hero">
      <div><span>${escapeHtml(recap.monthLabel)}</span><strong>${recap.miles ?? 0} miles</strong><small>${recap.driveCount} drive${recap.driveCount === 1 ? "" : "s"}</small></div>
      <div class="recap-efficiency"><span>Average efficiency</span><strong>${recap.averageWhMi ?? "--"}<small> Wh/mi</small></strong></div>
    </div>
    <div class="recap-grid">
      <article><span>Drive energy</span><strong>${recap.driveEnergyKWh ?? 0}<small> kWh</small></strong></article>
      <article><span>Charging</span><strong>${recap.chargingEnergyKWh ?? 0}<small> kWh</small></strong><small>${recap.chargingSessions} sessions</small></article>
      <article><span>Charging cost</span><strong>${recap.chargingCost == null ? "--" : money(recap.chargingCost)}</strong><small>${recap.chargingKnownCostSessions} costed sessions</small></article>
      <article><span>Soundtrack plays</span><strong>${recap.soundtrackPlays ?? 0}</strong><small>${recap.uniqueSongs ?? 0} unique songs</small></article>
      <article class="recap-wide"><span>Favorite route</span><strong>${escapeHtml(route)}</strong><small>${recap.favoriteRouteCount || 0} trips</small></article>
      <article><span>Longest drive</span><strong>${recap.longestDriveMiles == null ? "--" : `${recap.longestDriveMiles} mi`}</strong><small>${escapeHtml(recap.longestDriveDate || "")}</small></article>
      <article><span>Top track</span><strong>${escapeHtml(recap.topTrack || "--")}</strong><small>${escapeHtml(recap.topTrackArtist || "")}${recap.topTrackPlays ? ` \u00B7 ${recap.topTrackPlays} plays` : ""}</small></article>
      <article><span>Top artist</span><strong>${escapeHtml(recap.topArtist || "--")}</strong><small>${recap.topArtistPlays || 0} drive plays</small></article>
    </div>`;
}

async function loadRecaps() {
  try {
    const data = await getJson("/api/recap");
    state.recaps = data.recaps || [];
    const select = $("recapMonthSelect");
    if (select) {
      const current = select.value;
      select.innerHTML = state.recaps.map(item => `<option value="${escapeHtml(item.monthKey)}">${escapeHtml(item.monthLabel)}</option>`).join("");
      if (current && state.recaps.some(item => item.monthKey === current)) select.value = current;
      select.onchange = renderMonthlyRecap;
    }
    renderMonthlyRecap();
  } catch (error) {
    const container = $("monthlyRecap");
    if (container) container.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadDrives() {
  try {
    const data = await getJson("/api/drives");
    state.drives = data.drives || [];
    state.driveLibraryWindowDays = Number(data.windowDays) || 365;

    const dashboard = $("dashboardDrives");
    const all = $("allDrives");

    if (!state.drives.length) {
      const empty = `
        <div class="empty-state">
          <div class="empty-mark">\u2197</div>
          <h3>No new Tessie drives yet</h3>
          <p>Your next completed drive will appear here automatically.</p>
        </div>`;

      dashboard.innerHTML = empty;
      all.innerHTML = empty;
      setText("driveSearchCount", `0 drives \u00B7 ${state.driveLibraryWindowDays}-day library`, "0 drives");
      renderFavoriteRoutes();
      return;
    }

    dashboard.innerHTML = `<div class="drive-stack">${state.drives.slice(0, 3).map(d => driveCard(d, true)).join("")}</div>`;

    bindDriveButtons(dashboard);
    renderFavoriteRoutes();
    renderDriveLibrary();
  } catch (error) {
    const html = `<div class="empty-state"><h3>Drive history unavailable</h3><p>${escapeHtml(error.message)}</p></div>`;
    $("dashboardDrives").innerHTML = html;
    $("allDrives").innerHTML = html;
  }
}

function locationContains(value, query) {
  const terms = String(query || "")
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const haystack = String(value || "").toLocaleLowerCase();
  return terms.length > 0 && terms.every(term => haystack.includes(term));
}

function musicByLocationData(query, windowMinutes = 15) {
  const windowMs = Math.max(1, Number(windowMinutes) || 15) * 60 * 1000;
  const matchingDrives = state.drives.filter(drive =>
    locationContains(drive.startingLocation, query) ||
    locationContains(drive.endingLocation, query)
  );

  const plays = [];
  const seen = new Set();

  matchingDrives.forEach(drive => {
    const startMatch = locationContains(drive.startingLocation, query);
    const endMatch = locationContains(drive.endingLocation, query);
    const driveStart = new Date(drive.startedAt).getTime();
    const driveEnd = new Date(drive.endedAt).getTime();

    (drive.soundtrack || []).forEach(song => {
      const songStart = new Date(song.playedAt).getTime();
      if (!Number.isFinite(songStart)) return;

      const durationMs = Math.max(1, Number(song.durationMs) || 180000);
      const songEnd = songStart + durationMs;
      const nearStart = startMatch &&
        songEnd >= driveStart &&
        songStart <= driveStart + windowMs;
      const nearEnd = endMatch &&
        songEnd >= driveEnd - windowMs &&
        songStart <= driveEnd;
      const include = (startMatch && endMatch) || nearStart || nearEnd;

      if (!include) return;

      const key = `${drive.id}|${song.playedAt}|${song.trackId || song.track}`;
      if (seen.has(key)) return;
      seen.add(key);

      let locationLabel = "Matched drive location";
      if (nearStart && nearEnd) locationLabel = "Near start + destination";
      else if (nearStart) locationLabel = `Near ${compactLocation(drive.startingLocation) || "drive start"}`;
      else if (nearEnd) locationLabel = `Near ${compactLocation(drive.endingLocation) || "destination"}`;

      plays.push({
        ...song,
        driveId: drive.id,
        driveDate: drive.shortDateLabel,
        driveStartTime: drive.startTime,
        locationLabel
      });
    });
  });

  plays.sort((a, b) => String(b.playedAt).localeCompare(String(a.playedAt)));

  const countGroups = (items, keyFn) => {
    const groups = new Map();

    items.forEach(item => {
      const key = keyFn(item);
      if (!key) return;

      const existing = groups.get(key) || { count: 0, example: item };
      existing.count += 1;
      groups.set(key, existing);
    });

    return [...groups.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  };

  const topTracks = countGroups(plays, song => `${song.track}\u0000${song.artist}`)
    .slice(0, 8)
    .map(group => ({ ...group.example, plays: group.count }));

  const topArtists = countGroups(plays, song => song.artist)
    .slice(0, 8)
    .map(group => ({ artist: group.example.artist, plays: group.count }));

  return {
    query,
    windowMinutes: Number(windowMinutes) || 15,
    matchingDrives,
    plays,
    uniqueTracks: new Set(plays.map(song => `${song.track}\u0000${song.artist}`)).size,
    topTracks,
    topArtists
  };
}

function renderMusicLocationResults(data) {
  const container = $("musicLocationResults");
  const status = $("musicLocationStatus");
  if (!container) return;

  if (!data.matchingDrives.length) {
    if (status) status.textContent = `No Tessie drive origins or destinations matched \u201C${data.query}\u201D.`;
    container.innerHTML = `
      <div class="empty-state location-empty">
        <h3>No matching drive locations</h3>
        <p>Try a city, street, neighborhood, or destination text that appears in your Drive Library.</p>
      </div>`;
    return;
  }

  if (status) {
    status.textContent = `${data.plays.length} plays near ${data.matchingDrives.length} matching drive${data.matchingDrives.length === 1 ? "" : "s"} \u00B7 ${data.windowMinutes}-minute start/end window`;
  }

  const trackRows = data.topTracks.length
    ? data.topTracks.map((song, index) => `
        <div class="location-rank-row">
          <span class="location-rank-number">${index + 1}</span>
          ${songArtworkMarkup(song, "location-track-artwork")}
          <div>
            <strong>${escapeHtml(song.track)}</strong>
            <span>${escapeHtml(song.artist)}</span>
          </div>
          <b>${song.plays}\u00D7</b>
        </div>`).join("")
    : `<div class="muted">No archived Spotify songs fell inside the selected location window.</div>`;

  const artistRows = data.topArtists.length
    ? data.topArtists.map((artist, index) => `
        <div class="location-artist-row">
          <span>${index + 1}</span>
          <strong>${escapeHtml(artist.artist)}</strong>
          <b>${artist.plays}\u00D7</b>
        </div>`).join("")
    : `<div class="muted">No artist data available.</div>`;

  const recentRows = data.plays.slice(0, 20).map(song => `
    <div class="location-play-row">
      ${songArtworkMarkup(song, "location-play-artwork")}
      <div class="location-play-copy">
        <strong>${escapeHtml(song.track)}</strong>
        <span>${escapeHtml(song.artist)} \u00B7 ${escapeHtml(song.locationLabel)}</span>
        <small>${escapeHtml(song.driveDate || "")} ${escapeHtml(song.time || "")}</small>
      </div>
      <button class="text-button location-open-drive" type="button" data-location-drive="${escapeHtml(song.driveId)}">Open drive \u2192</button>
    </div>`).join("");

  container.innerHTML = `
    <div class="location-summary-grid">
      <div><span>Matching drives</span><strong>${data.matchingDrives.length}</strong></div>
      <div><span>Located plays</span><strong>${data.plays.length}</strong></div>
      <div><span>Unique tracks</span><strong>${data.uniqueTracks}</strong></div>
    </div>

    <div class="location-results-grid">
      <section>
        <div class="section-label">TOP TRACKS</div>
        <div class="location-rank-list">${trackRows}</div>
      </section>
      <section>
        <div class="section-label">TOP ARTISTS</div>
        <div class="location-artist-list">${artistRows}</div>
      </section>
    </div>

    <section class="location-recent-section">
      <div class="section-label">RECENT PLAYS</div>
      <div class="location-recent-list">${recentRows || '<div class="muted">No matching plays.</div>'}</div>
    </section>`;

  container.querySelectorAll("[data-location-drive]").forEach(button => {
    button.addEventListener("click", () => {
      const drive = state.drives.find(item => item.id === button.dataset.locationDrive);
      if (drive) openDriveModal(drive);
    });
  });
}

function runMusicLocationSearch() {
  const query = $("musicLocationQuery")?.value?.trim() || "";
  const minutes = Number($("musicLocationMinutes")?.value || 15);
  const container = $("musicLocationResults");
  const status = $("musicLocationStatus");

  if (query.length < 2) {
    if (status) status.textContent = "Enter at least two characters to search your Tessie locations.";
    if (container) container.innerHTML = "";
    return;
  }

  renderMusicLocationResults(musicByLocationData(query, minutes));
}

function bindMusicLocationSearch() {
  $("musicLocationForm")?.addEventListener("submit", event => {
    event.preventDefault();
    runMusicLocationSearch();
  });

  $("musicLocationMinutes")?.addEventListener("change", () => {
    if ($("musicLocationQuery")?.value?.trim()) runMusicLocationSearch();
  });
}

async function loadMusicStats() {
  try {
    const data = await getJson("/api/music/stats");
    setText("musicTotalPlays", data.totalPlays, "0");

    $("topTracks").innerHTML = (data.topTracks || []).length
      ? data.topTracks.map((item, i) => `
          <div class="rank-row track-rank-row">
            <div class="rank-number">${String(i + 1).padStart(2, "0")}</div>
            ${songArtworkMarkup(item, "rank-artwork")}
            <div>
              <div class="rank-primary">${escapeHtml(item.track)}</div>
              <div class="rank-secondary">${escapeHtml(item.artist)}</div>
            </div>
            <div class="rank-count">${item.plays} play${item.plays === 1 ? "" : "s"}</div>
          </div>`).join("")
      : `<div class="empty-state"><p>Not enough listening history yet.</p></div>`;

    $("topArtists").innerHTML = (data.topArtists || []).length
      ? data.topArtists.map((item, i) => `
          <div class="rank-row">
            <div class="rank-number">${String(i + 1).padStart(2, "0")}</div>
            <div><div class="rank-primary">${escapeHtml(item.artist)}</div></div>
            <div class="rank-count">${item.plays} play${item.plays === 1 ? "" : "s"}</div>
          </div>`).join("")
      : `<div class="empty-state"><p>Not enough listening history yet.</p></div>`;

    const daily = data.daily || [];
    const max = Math.max(1, ...daily.map(d => Number(d.count) || 0));

    $("musicTimeline").innerHTML = daily.map(day => {
      const count = Number(day.count) || 0;
      const height = Math.max(count ? 8 : 3, Math.round((count / max) * 145));

      return `
        <div class="timeline-day" title="${count} plays">
          <div class="timeline-count">${count}</div>
          <div class="timeline-bar-wrap">
            <div class="timeline-bar" style="height:${height}px"></div>
          </div>
          <div class="timeline-label">${escapeHtml(day.label)}</div>
        </div>`;
    }).join("");
  } catch (error) {
    $("topTracks").innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadStatistics() {
  try {
    const data = await getJson("/api/statistics");

    setText("statDriveCount", data.driveCount, "0");
    setText("statMiles", data.totalMiles, "0");
    setText("statEnergy", data.totalEnergyKWh, "0");
    setText("statEfficiency", data.averageWhMi, "--");
    setText("statBattery", data.totalBatteryUsed, "0");
    setText("statSongs", data.soundtrackSongs, "0");
  } catch (error) {
    console.error(error);
  }
}

function metric(label, value) {
  return `<div class="detail-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function openDriveModal(drive) {
  state.selectedDrive = drive;

  setText("modalDriveDate", drive.dateLabel);
  setText("modalDriveTime", `${drive.startTime} \u2192 ${drive.endTime}`);

  $("modalMetrics").innerHTML = [
    metric("Distance", `${drive.miles ?? "--"} mi`),
    metric("Duration", `${drive.durationMinutes ?? "--"} min`),
    metric("Battery", batteryText(drive)),
    metric("Energy", `${drive.energyKWh ?? "--"} kWh`),
    metric("Efficiency", drive.efficiencyWhMi != null ? `${drive.efficiencyWhMi} Wh/mi` : "--"),
    metric("Average speed", drive.averageSpeed != null ? `${drive.averageSpeed} mph` : "--"),
    metric("Max speed", drive.maxSpeed != null ? `${drive.maxSpeed} mph` : "--"),
    metric("Battery used", drive.batteryUsed != null ? `${drive.batteryUsed}%` : "--")
  ].join("");

  const songs = drive.soundtrack || [];
  setText("modalSongCount", `${songs.length} song${songs.length === 1 ? "" : "s"}`);

  $("modalSoundtrack").innerHTML = songs.length
    ? songs.map((song, index) => `
        <div class="soundtrack-row" data-song-index="${index + 1}">
          <div class="soundtrack-time">${escapeHtml(song.time)}</div>
          ${songArtworkMarkup(song, "soundtrack-artwork")}
          <div class="soundtrack-copy">
            <div class="soundtrack-title">
              <span class="soundtrack-number">${index + 1}</span>
              ${escapeHtml(song.track)}
            </div>
            <div class="soundtrack-artist">${escapeHtml(song.artist)}</div>
            <div class="soundtrack-location" data-song-location="${index + 1}">Locating with Tessie GPS\u2026</div>
            ${song.spotifyUrl ? `
              <a class="soundtrack-spotify-link"
                 href="${escapeHtml(song.spotifyUrl)}"
                 target="_blank"
                 rel="noopener noreferrer">\u25B6 Play on Spotify</a>` : ""}
          </div>
        </div>`).join("")
    : `<div class="empty-state"><h3>No archived Spotify matches</h3><p>DriveOS only knows songs it has already captured in the local Spotify archive.</p></div>`;

  $("playlistButton").disabled = songs.length === 0;
  $("shareXButton").disabled = false;

  if (!state.playlistScope) {
    $("playlistButton").title = "Run the updated Connect-Spotify.ps1 once to grant playlist access.";
  } else {
    $("playlistButton").title = "";
  }

  stopReplay();
  clearMapMusicNearby();
  setText("modalMessage", "");
  setText("driveMapStatus", "Loading Tessie GPS history\u2026");
  setText("replayTrack", "Loading drive replay\u2026");
  setText("replayArtist", "\u2014");
  setText("replayAlbum", "");
  setText("replayClock", "--:--:--");
  setText("replaySpeed", "--");
  setText("replayBattery", "--");
  setText("replayElapsed", "0:00");
  setText("replayRemaining", "-0:00");
  $("replayScrubber").value = "0";
  $("replayPlayPause").textContent = "\u25B6 Replay drive";
  $("replayPlayPause").disabled = true;
  $("replayScrubber").disabled = true;
  updateReplayArtwork(null);

  $("driveMap").classList.remove("map-unavailable");
  $("driveMap").innerHTML = "";

  $("driveModal").classList.add("open");
  $("driveModal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // MapLibre needs the modal to be visible before it can measure the container.
  setTimeout(() => loadDriveMap(drive), 40);
}

function closeDriveModal() {
  stopReplay();

  if (state.replayMarker) {
    state.replayMarker.remove();
    state.replayMarker = null;
  }

  state.replayMarkerElement = null;
  state.replayCurrentDriveMs = 0;
  state.replayLastSongIndex = null;

  $("driveModal").classList.remove("open");
  $("driveModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  if (state.driveMap) {
    state.driveMap.remove();
    state.driveMap = null;
  }

  clearMapMusicNearby();
  state.driveMapData = null;
  state.songMapMarkers = new Map();
  state.selectedDrive = null;
}

document.querySelectorAll("[data-close-modal]").forEach(el => {
  el.addEventListener("click", closeDriveModal);
});

$("mapMusicRadius")?.addEventListener("change", renderMapMusicNearby);
$("mapMusicNearbyClose")?.addEventListener("click", clearMapMusicNearby);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDriveModal();
});


function mapPopupHtml(marker) {
  const speed = marker.speed != null ? `${marker.speed} mph` : "speed unavailable";
  const battery = marker.battery != null ? `${marker.battery}% battery` : "battery unavailable";
  const offset = marker.offsetSeconds != null
    ? `GPS sample ${marker.offsetSeconds}s from song start`
    : "GPS timing unavailable";

  return `
    <div class="map-popup-song">
      ${songArtworkMarkup(marker, "map-popup-artwork")}
      <div>
        <div class="map-popup-track">${escapeHtml(marker.track)}</div>
        <div class="map-popup-artist">${escapeHtml(marker.artist)}</div>
      </div>
    </div>
    <div class="map-popup-meta">
      ${escapeHtml(marker.time)}<br>
      ${escapeHtml(speed)} \u00B7 ${escapeHtml(battery)}<br>
      ${escapeHtml(offset)}
    </div>`;
}

function setSongLocationText(marker) {
  const target = document.querySelector(`[data-song-location="${marker.index}"]`);
  if (!target) return;

  if (marker.latitude == null || marker.longitude == null) {
    target.textContent = "No Tessie GPS point was available for this song start.";
    return;
  }

  const pieces = [];

  if (marker.speed != null) pieces.push(`${marker.speed} mph`);
  if (marker.battery != null) pieces.push(`${marker.battery}% battery`);

  if (marker.offsetSeconds != null) {
    pieces.push(
      marker.offsetSeconds <= 15
        ? `GPS \u00B1${marker.offsetSeconds}s`
        : `nearest GPS point \u00B1${marker.offsetSeconds}s`
    );
  }

  target.textContent = pieces.join(" \u00B7 ") || "Tessie GPS location matched";
}

function highlightSongRow(index) {
  document.querySelectorAll(".soundtrack-row[data-song-index]").forEach(row => {
    row.classList.toggle("map-active", Number(row.dataset.songIndex) === Number(index));
  });

  state.songMapMarkers.forEach((markerRecord, key) => {
    markerRecord.element.classList.toggle("active", Number(key) === Number(index));
  });
}

function focusSongOnMap(index) {
  const markerRecord = state.songMapMarkers.get(Number(index));

  if (!markerRecord || !state.driveMap) return;

  highlightSongRow(index);

  state.driveMap.flyTo({
    center: [markerRecord.data.longitude, markerRecord.data.latitude],
    zoom: Math.max(state.driveMap.getZoom(), 14),
    essential: true
  });

  markerRecord.popup.addTo(state.driveMap);
}

function bindSoundtrackMapRows() {
  document.querySelectorAll(".soundtrack-row[data-song-index]").forEach(row => {
    row.addEventListener("click", () => {
      focusSongOnMap(Number(row.dataset.songIndex));
    });
  });

  document.querySelectorAll(".soundtrack-spotify-link").forEach(link => {
    link.addEventListener("click", event => {
      event.stopPropagation();
    });
  });
}

function addTerminalMarker(map, point, type, label) {
  if (!point || point.latitude == null || point.longitude == null) return;

  const el = document.createElement("div");
  el.className = `map-terminal-marker ${type}`;
  el.title = label;

  new maplibregl.Marker({ element: el })
    .setLngLat([point.longitude, point.latitude])
    .setPopup(
      new maplibregl.Popup({ offset: 16 }).setHTML(
        `<div class="map-popup-track">${escapeHtml(label)}</div>
         <div class="map-popup-meta">${escapeHtml(point.time || "")}</div>`
      )
    )
    .addTo(map);
}

function fitDriveMap(map, points) {
  if (!points.length) return;

  if (points.length === 1) {
    map.setCenter([points[0].longitude, points[0].latitude]);
    map.setZoom(15);
    return;
  }

  const bounds = new maplibregl.LngLatBounds();

  points.forEach(point => {
    bounds.extend([point.longitude, point.latitude]);
  });

  map.fitBounds(bounds, {
    padding: { top: 55, right: 55, bottom: 55, left: 55 },
    maxZoom: 15,
    duration: 700
  });
}

function clearMapMusicNearby() {
  state.mapMusicPoint = null;

  if (state.mapMusicMarker) {
    state.mapMusicMarker.remove();
    state.mapMusicMarker = null;
  }

  const panel = $("mapMusicNearby");
  if (panel) panel.hidden = true;
}

function renderMapMusicNearby() {
  const panel = $("mapMusicNearby");
  const songs = $("mapMusicNearbySongs");
  const summary = $("mapMusicNearbySummary");

  if (!panel || !songs || !summary || !state.mapMusicPoint) return;

  const radius = Math.max(0.1, Number($("mapMusicRadius")?.value || 1));
  const markers = (state.driveMapData?.songMarkers || [])
    .filter(marker => marker.latitude != null && marker.longitude != null)
    .map(marker => ({
      ...marker,
      distanceMiles: geoDistanceMiles(
        state.mapMusicPoint.lat,
        state.mapMusicPoint.lng,
        marker.latitude,
        marker.longitude
      )
    }))
    .filter(marker => marker.distanceMiles <= radius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  panel.hidden = false;
  summary.textContent = markers.length
    ? `${markers.length} song${markers.length === 1 ? "" : "s"} within ${radius} mi`
    : `No song starts within ${radius} mi`;

  songs.innerHTML = markers.length
    ? markers.map(marker => `
        <button class="map-nearby-song" type="button" data-nearby-song="${marker.index}">
          ${songArtworkMarkup(marker, "map-nearby-artwork")}
          <span>
            <strong>${escapeHtml(marker.track)}</strong>
            <small>${escapeHtml(marker.artist)} \u00B7 ${marker.distanceMiles.toFixed(2)} mi away</small>
          </span>
        </button>`).join("")
    : `<div class="map-nearby-empty">Try a larger radius or click closer to one of the numbered song markers.</div>`;

  songs.querySelectorAll("[data-nearby-song]").forEach(button => {
    button.addEventListener("click", () => {
      focusSongOnMap(Number(button.dataset.nearbySong));
    });
  });
}

function setMapMusicPoint(lat, lng) {
  state.mapMusicPoint = { lat: Number(lat), lng: Number(lng) };

  if (!state.driveMap || !Number.isFinite(state.mapMusicPoint.lat) || !Number.isFinite(state.mapMusicPoint.lng)) {
    return;
  }

  if (state.mapMusicMarker) state.mapMusicMarker.remove();

  const element = document.createElement("div");
  element.className = "map-music-query-marker";
  element.title = "Music search point";

  state.mapMusicMarker = new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([state.mapMusicPoint.lng, state.mapMusicPoint.lat])
    .addTo(state.driveMap);

  renderMapMusicNearby();
}

function renderDriveMap(data) {
  state.driveMapData = data;
  state.songMapMarkers = new Map();

  const routePoints = (data.routePoints || []).filter(
    p => p.latitude != null && p.longitude != null
  );

  const songMarkers = data.songMarkers || [];

  songMarkers.forEach(setSongLocationText);
  bindSoundtrackMapRows();

  if (!window.maplibregl) {
    $("driveMap").classList.add("map-unavailable");
    $("driveMap").textContent = "MapLibre did not load. Check your internet connection and reload DriveOS.";
    setText("driveMapStatus", "Map library unavailable");
    return;
  }

  if (!routePoints.length) {
    $("driveMap").classList.add("map-unavailable");
    $("driveMap").textContent =
      data.message || "Tessie did not return route GPS points for this drive.";
    setText("driveMapStatus", "No route GPS available");
    $("replayPlayPause").disabled = true;
    $("replayScrubber").disabled = true;
    return;
  }

  if (state.driveMap) {
    state.driveMap.remove();
    state.driveMap = null;
  }

  const first = routePoints[0];

  const map = new maplibregl.Map({
    container: "driveMap",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [first.longitude, first.latitude],
    zoom: 12,
    attributionControl: true
  });

  state.driveMap = map;

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: true }),
    "top-right"
  );

  map.on("click", event => {
    if (event.originalEvent?.target?.closest?.(".map-song-marker, .mapboxgl-ctrl, .maplibregl-ctrl")) {
      return;
    }

    setMapMusicPoint(event.lngLat.lat, event.lngLat.lng);
  });

  map.on("load", () => {
    const coordinates = routePoints.map(
      point => [point.longitude, point.latitude]
    );

    map.addSource("drive-route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates
        }
      }
    });

    map.addLayer({
      id: "drive-route-shadow",
      type: "line",
      source: "drive-route",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "#071016",
        "line-width": 8,
        "line-opacity": 0.48
      }
    });

    map.addLayer({
      id: "drive-route-line",
      type: "line",
      source: "drive-route",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "#7be7ff",
        "line-width": 4,
        "line-opacity": 0.95
      }
    });

    addTerminalMarker(map, data.startMarker, "start", "Drive start");
    addTerminalMarker(map, data.endMarker, "end", "Drive end");

    songMarkers.forEach(marker => {
      if (marker.latitude == null || marker.longitude == null) return;

      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-song-marker";
      el.textContent = marker.index;
      el.title = `${marker.track} \u2014 ${marker.artist}`;
      el.setAttribute("aria-label", `Song ${marker.index}: ${marker.track}`);

      const popup = new maplibregl.Popup({ offset: 21 }).setHTML(
        mapPopupHtml(marker)
      );

      const mapMarker = new maplibregl.Marker({
        element: el,
        anchor: "center"
      })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        highlightSongRow(marker.index);
      });

      state.songMapMarkers.set(Number(marker.index), {
        marker: mapMarker,
        popup,
        element: el,
        data: marker
      });
    });

    fitDriveMap(map, routePoints);

    const locatedSongs = songMarkers.filter(
      marker => marker.latitude != null && marker.longitude != null
    ).length;

    setText(
      "driveMapStatus",
      `${routePoints.length} route points \u00B7 ${locatedSongs}/${songMarkers.length} songs located`
    );

    initializeReplay();
  });

  map.on("error", event => {
    console.error("MapLibre error:", event?.error || event);
  });
}

async function loadDriveMap(drive) {
  try {
    const data = await postJson("/api/drive/map", {
      driveId: drive.id
    });

    // Ignore a late response if the user already opened another drive.
    if (!state.selectedDrive || state.selectedDrive.id !== drive.id) {
      return;
    }

    renderDriveMap(data);
  } catch (error) {
    $("driveMap").classList.add("map-unavailable");
    $("driveMap").textContent = error.message;
    setText("driveMapStatus", "GPS map unavailable");

    document.querySelectorAll("[data-song-location]").forEach(el => {
      el.textContent = "Tessie GPS lookup unavailable.";
    });
  }
}


function formatReplayDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function routeTimestampMs(point) {
  return Number(point.timestamp) * 1000;
}

function interpolateNumber(a, b, t) {
  const av = Number(a);
  const bv = Number(b);

  if (!Number.isFinite(av) && !Number.isFinite(bv)) return null;
  if (!Number.isFinite(av)) return bv;
  if (!Number.isFinite(bv)) return av;

  return av + ((bv - av) * t);
}

function normalizeHeadingDelta(from, to) {
  let delta = Number(to) - Number(from);

  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  return delta;
}

function getReplayStateAt(ms) {
  const points = state.driveMapData?.routePoints || [];

  if (!points.length) return null;

  const firstMs = routeTimestampMs(points[0]);
  const lastMs = routeTimestampMs(points[points.length - 1]);
  const targetMs = Math.max(firstMs, Math.min(lastMs, ms));

  if (targetMs <= firstMs) {
    return { ...points[0], timestampMs: firstMs };
  }

  if (targetMs >= lastMs) {
    return { ...points[points.length - 1], timestampMs: lastMs };
  }

  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midMs = routeTimestampMs(points[mid]);

    if (midMs < targetMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const rightIndex = Math.min(points.length - 1, low);
  const leftIndex = Math.max(0, rightIndex - 1);

  const left = points[leftIndex];
  const right = points[rightIndex];

  const leftMs = routeTimestampMs(left);
  const rightMs = routeTimestampMs(right);
  const span = Math.max(1, rightMs - leftMs);
  const t = Math.max(0, Math.min(1, (targetMs - leftMs) / span));

  let heading = left.heading;

  if (
    left.heading != null &&
    right.heading != null
  ) {
    heading = Number(left.heading) +
      normalizeHeadingDelta(left.heading, right.heading) * t;

    if (heading < 0) heading += 360;
    if (heading >= 360) heading -= 360;
  }

  return {
    latitude: interpolateNumber(left.latitude, right.latitude, t),
    longitude: interpolateNumber(left.longitude, right.longitude, t),
    speed: interpolateNumber(left.speed, right.speed, t),
    battery: interpolateNumber(left.battery, right.battery, t),
    heading,
    timestampMs: targetMs
  };
}

function replaySongAt(ms) {
  const songs = state.driveMapData?.songMarkers || [];

  if (!songs.length) return null;

  let active = null;

  for (const song of songs) {
    const start = new Date(song.playedAt).getTime();
    const duration = Math.max(1, Number(song.durationMs) || 180000);
    const end = start + duration;

    if (ms >= start && ms < end) {
      active = song;
    }

    if (start > ms) break;
  }

  return active;
}

function updateReplayArtwork(song) {
  const artLink = $("replayArtworkLink");
  const trackLink = $("replayTrackLink");
  const playSpotify = $("replayPlaySpotify");

  const spotifyUrl = song?.spotifyUrl || "https://open.spotify.com/";
  const hasTrackLink = Boolean(song?.spotifyUrl);

  artLink.href = spotifyUrl;
  trackLink.href = spotifyUrl;
  playSpotify.href = spotifyUrl;
  playSpotify.setAttribute("aria-disabled", hasTrackLink ? "false" : "true");
  playSpotify.classList.toggle("disabled", !hasTrackLink);

  // Use the exact same artwork renderer used by Dashboard, Music,
  // soundtrack rows, and map popups.
  artLink.innerHTML = songArtworkMarkup(song || {}, "replay-artwork");
}

function updateReplayNowPlaying(ms) {
  const song = replaySongAt(ms);

  if (!song) {
    setText("replayTrack", "No archived song at this moment");
    setText("replayArtist", "\u2014");
    setText("replayAlbum", "");
    updateReplayArtwork(null);

    if (state.replayLastSongIndex !== null) {
      highlightSongRow(-1);
      state.replayLastSongIndex = null;
    }

    return;
  }

  setText("replayTrack", song.track);
  setText("replayArtist", song.artist);
  setText("replayAlbum", song.album || "");
  updateReplayArtwork(song);

  if (state.replayLastSongIndex !== song.index) {
    highlightSongRow(song.index);
    state.replayLastSongIndex = song.index;
  }
}

function updateReplayUi(ms, followMap = false) {
  const points = state.driveMapData?.routePoints || [];
  if (!points.length) return;

  const firstMs = routeTimestampMs(points[0]);
  const lastMs = routeTimestampMs(points[points.length - 1]);
  const duration = Math.max(1, lastMs - firstMs);
  const clamped = Math.max(firstMs, Math.min(lastMs, ms));

  state.replayCurrentDriveMs = clamped;

  const vehicle = getReplayStateAt(clamped);

  if (vehicle) {
    if (state.replayMarker) {
      state.replayMarker.setLngLat([
        vehicle.longitude,
        vehicle.latitude
      ]);
    }

    if (
      state.replayMarkerElement &&
      vehicle.heading != null
    ) {
      const arrow = state.replayMarkerElement.querySelector(
        ".replay-car-arrow"
      );

      if (arrow) {
        arrow.style.transform = `rotate(${Number(vehicle.heading)}deg)`;
      }
    }

    if (
      followMap &&
      state.driveMap &&
      vehicle.longitude != null &&
      vehicle.latitude != null
    ) {
      state.driveMap.easeTo({
        center: [vehicle.longitude, vehicle.latitude],
        duration: 250
      });
    }

    const clock = new Date(clamped).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });

    setText("replayClock", clock);
    setText(
      "replaySpeed",
      vehicle.speed != null
        ? Math.max(0, Math.round(Number(vehicle.speed)))
        : "--"
    );
    setText(
      "replayBattery",
      vehicle.battery != null
        ? Math.round(Number(vehicle.battery))
        : "--"
    );
  }

  const position = (clamped - firstMs) / duration;
  $("replayScrubber").value = String(Math.round(position * 1000));
  setText("replayElapsed", formatReplayDuration(clamped - firstMs));
  setText("replayRemaining", `-${formatReplayDuration(lastMs - clamped)}`);

  updateReplayNowPlaying(clamped);
}

function createReplayMarker() {
  if (!state.driveMap || !state.driveMapData?.routePoints?.length) {
    return;
  }

  if (state.replayMarker) {
    state.replayMarker.remove();
  }

  const first = state.driveMapData.routePoints[0];

  const el = document.createElement("div");
  el.className = "replay-car-marker";
  el.innerHTML = `<div class="replay-car-arrow"></div>`;
  el.title = "Eloise replay position";

  state.replayMarkerElement = el;

  state.replayMarker = new maplibregl.Marker({
    element: el,
    anchor: "center"
  })
    .setLngLat([first.longitude, first.latitude])
    .addTo(state.driveMap);
}

function stopReplay(resetButton = true) {
  state.replayPlaying = false;

  if (state.replayAnimationFrame) {
    cancelAnimationFrame(state.replayAnimationFrame);
    state.replayAnimationFrame = null;
  }

  if (resetButton) {
    $("replayPlayPause").textContent = "\u25B6 Replay drive";
  }
}

function replayFrame(now) {
  if (!state.replayPlaying) return;

  const points = state.driveMapData?.routePoints || [];

  if (!points.length) {
    stopReplay();
    return;
  }

  const lastMs = routeTimestampMs(points[points.length - 1]);
  const rate = Number($("replayRate").value) || 4;
  const elapsedWall = now - state.replayStartWallTime;
  const nextMs = state.replayStartDriveMs + (elapsedWall * rate);

  if (nextMs >= lastMs) {
    updateReplayUi(lastMs, true);
    stopReplay();
    $("replayPlayPause").textContent = "\u21BA Replay again";
    return;
  }

  updateReplayUi(nextMs, true);
  state.replayAnimationFrame = requestAnimationFrame(replayFrame);
}

function playReplay() {
  const points = state.driveMapData?.routePoints || [];
  if (!points.length) return;

  const firstMs = routeTimestampMs(points[0]);
  const lastMs = routeTimestampMs(points[points.length - 1]);

  if (state.replayCurrentDriveMs >= lastMs - 500) {
    state.replayCurrentDriveMs = firstMs;
    updateReplayUi(firstMs, false);
  }

  state.replayPlaying = true;
  state.replayStartWallTime = performance.now();
  state.replayStartDriveMs = state.replayCurrentDriveMs || firstMs;

  $("replayPlayPause").textContent = "\u275A\u275A Pause";

  state.replayAnimationFrame = requestAnimationFrame(replayFrame);
}

function initializeReplay() {
  const points = state.driveMapData?.routePoints || [];

  stopReplay();

  if (!points.length) {
    $("replayPlayPause").disabled = true;
    $("replayScrubber").disabled = true;
    return;
  }

  $("replayPlayPause").disabled = false;
  $("replayScrubber").disabled = false;

  createReplayMarker();

  const firstMs = routeTimestampMs(points[0]);
  state.replayCurrentDriveMs = firstMs;
  state.replayLastSongIndex = null;

  updateReplayUi(firstMs, false);
}

$("replayPlayPause").addEventListener("click", () => {
  if (state.replayPlaying) {
    stopReplay();
  } else {
    playReplay();
  }
});

$("replayRestart").addEventListener("click", () => {
  stopReplay();

  const points = state.driveMapData?.routePoints || [];
  if (!points.length) return;

  const firstMs = routeTimestampMs(points[0]);
  updateReplayUi(firstMs, false);

  if (state.driveMap) {
    fitDriveMap(state.driveMap, points);
  }
});

$("replayScrubber").addEventListener("input", event => {
  const points = state.driveMapData?.routePoints || [];
  if (!points.length) return;

  stopReplay();

  const firstMs = routeTimestampMs(points[0]);
  const lastMs = routeTimestampMs(points[points.length - 1]);
  const value = Number(event.target.value) / 1000;
  const target = firstMs + ((lastMs - firstMs) * value);

  updateReplayUi(target, true);
});

$("replayRate").addEventListener("change", () => {
  if (!state.replayPlaying) return;

  // Restart the wall-clock calculation at the current drive position
  // so changing speed doesn't make the replay jump.
  state.replayStartWallTime = performance.now();
  state.replayStartDriveMs = state.replayCurrentDriveMs;
});

$("shareXButton").addEventListener("click", () => {
  const d = state.selectedDrive;
  if (!d) return;

  const soundtrack = d.songCount
    ? ` Soundtrack: ${d.songCount} Spotify song${d.songCount === 1 ? "" : "s"}.`
    : "";

  const text =
    `DriveOS: ${d.miles ?? "--"} miles in ${d.durationMinutes ?? "--"} minutes, ` +
    `${batteryText(d)} battery.${soundtrack}`;

  window.open(
    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer,width=700,height=600"
  );
});

$("playlistButton").addEventListener("click", async () => {
  const d = state.selectedDrive;
  if (!d) return;

  const button = $("playlistButton");
  button.disabled = true;
  button.textContent = "Creating\u2026";
  setText("modalMessage", "");

  try {
    const result = await postJson("/api/playlist/create", { driveId: d.id });

    setText(
      "modalMessage",
      `Created "${result.playlistName}" with ${result.trackCount} track${result.trackCount === 1 ? "" : "s"}.`
    );

    if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    setText("modalMessage", error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Create Spotify playlist";
  }
});

async function recoverSpotifyAndRematch() {
  // Spotify must finish archiving first. Drive matching reads the local archive,
  // so running these in parallel can leave a freshly recovered drive at 0 songs.
  const spotify = await loadSpotify();

  if (!spotify) return false;

  await Promise.allSettled([
    loadDrives(),
    loadMusicStats(),
    loadStatistics(),
    loadPlaces(),
    loadCharging(),
    loadRecaps()
  ]);

  return true;
}

async function connectSpotifyOnThisComputer() {
  if (state.spotifyConnecting) return;

  const button = $("spotifyConnectButton");
  state.spotifyConnecting = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Opening Spotify\u2026";
  }

  try {
    await postJson("/api/spotify/connect", {});
    setText("archiveAdded", "Finish authorization in your browser\u2026");

    // The authorization script runs separately and writes spotify-token.json.
    // Poll only the lightweight Spotify auth endpoint, not Tessie/status.
    const deadline = Date.now() + 5 * 60 * 1000;

    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2500));

      try {
        const auth = await getJson("/api/spotify/auth-status");
        if (!auth.authorized) continue;

        state.spotifyAuthorized = true;
        if (button) button.hidden = true;
        setText("archiveAdded", "Spotify connected \u2014 recovering recent plays\u2026");

        await recoverSpotifyAndRematch();
        await loadStatus();
        return;
      } catch {
        // Keep waiting while the user is completing the browser authorization.
      }
    }

    setText("archiveAdded", "Authorization window expired \u2014 click Connect Spotify to retry");
  } catch (error) {
    setText("archiveAdded", error.message || "Could not start Spotify authorization");
  } finally {
    state.spotifyConnecting = false;
    if (button) {
      button.disabled = false;
      button.textContent = "Connect Spotify";
    }
  }
}

async function refreshAll() {
  const button = $("refreshButton");

  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing\u2026";
  }

  // Vehicle/status can load immediately. Spotify recovery must finish before
  // drive/music/stat matching reads the local archive.
  await Promise.allSettled([
    loadStatus(),
    loadVehicle()
  ]);

  const spotify = await loadSpotify();

  await Promise.allSettled([
    loadDrives(),
    loadMusicStats(),
    loadStatistics(),
    loadPlaces(),
    loadCharging(),
    loadRecaps()
  ]);

  if (button) {
    button.disabled = false;
    button.textContent = "Refresh data";
  }
}

$("refreshButton").addEventListener("click", refreshAll);

const spotifyConnectButton = $("spotifyConnectButton");
if (spotifyConnectButton) {
  spotifyConnectButton.addEventListener("click", connectSpotifyOnThisComputer);
}


// ---------------------------------------------------------------------
// DriveOS 2.0.2 \u2014 persistent Dark / Light theme
// ---------------------------------------------------------------------

const DRIVEOS_THEME_KEY = "driveos-theme";

function storedDriveOSTheme() {
  try {
    const saved = localStorage.getItem(DRIVEOS_THEME_KEY);

    // Light is the DriveOS default. An explicit Dark choice remains respected.
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyDriveOSTheme(theme, persist = true) {
  const selected = theme === "light" ? "light" : "dark";

  document.documentElement.dataset.theme = selected;

  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    const active = button.dataset.themeChoice === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (persist) {
    try {
      localStorage.setItem(DRIVEOS_THEME_KEY, selected);
    } catch {
      // Theme persistence is non-critical; keep the selected theme for this session.
    }
  }
}

function initializeDriveOSTheme() {
  applyDriveOSTheme(storedDriveOSTheme(), false);

  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.addEventListener("click", () => {
      applyDriveOSTheme(button.dataset.themeChoice);
    });
  });
}

initializeDriveOSTheme();


// ---------------------------------------------------------------------
// DriveOS 3.0 \u2014 Ignition launch sequence
// The native Windows host starts this only after WebView2 is fully ready.
// ---------------------------------------------------------------------

function runDriveOSIgnition() {
  const ignition = $("driveosIgnition");
  if (!ignition) return;

  const status = $("ignitionSystemText");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // Lock the underlying dashboard only while the launch surface is visible.
  document.body.classList.add("ignition-active");

  if (reducedMotion) {
    if (status) status.textContent = "VEHICLE INTELLIGENCE ONLINE";

    window.setTimeout(() => {
      ignition.classList.add("ignition-complete");
      document.body.classList.remove("ignition-active");
    }, 320);

    window.setTimeout(() => ignition.remove(), 720);
    return;
  }

  const messages = [
    [480, "LINKING VEHICLE TELEMETRY"],
    [920, "MAPPING DRIVE MEMORY"],
    [1360, "ASSEMBLING DRIVEOS INTERFACE"],
    [1800, "VEHICLE INTELLIGENCE ONLINE"]
  ];

  messages.forEach(([delay, message]) => {
    window.setTimeout(() => {
      if (!status || !document.body.contains(status)) return;

      status.classList.remove("ignition-system-text-swap");
      // Force a reflow so each status update gets its own subtle reveal.
      void status.offsetWidth;
      status.textContent = message;
      status.classList.add("ignition-system-text-swap");
    }, delay);
  });

  window.setTimeout(() => {
    ignition.classList.add("ignition-ready");
  }, 1820);

  window.setTimeout(() => {
    ignition.classList.add("ignition-complete");
    document.body.classList.remove("ignition-active");
  }, 2240);

  window.setTimeout(() => {
    ignition.remove();
  }, 2920);
}

initializeMobileNavigationPortal();
purgeOldDriveOSCaches();
initializePwa();

if (isTailnetRemote()) {
  runDriveOSIgnition();
}

updateClock();
setInterval(updateClock, 30_000);

const initialView = ["dashboard", "drives", "music", "statistics"].includes(location.hash.slice(1))
  ? location.hash.slice(1)
  : "dashboard";

showView(initialView);
refreshAll();

// Vehicle/status: every 2 minutes.
// Spotify / drives / analytics: every 5 minutes.
setInterval(() => {
  loadVehicle();
  loadStatus();
}, 120_000);

setInterval(async () => {
  await loadSpotify();
  await Promise.allSettled([
    loadDrives(),
    loadMusicStats(),
    loadStatistics(),
    loadPlaces(),
    loadCharging(),
    loadRecaps()
  ]);
}, 300_000);
