(() => {
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    if (!response.ok) throw new Error("Could not load JourneyDeck.");
    return response.json();
  };
  const displayUpdated = (value) => {
    const seconds = Number(value);
    const date = Number.isFinite(seconds) && seconds > 1e9 ? new Date(seconds * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? "Car status is up to date" : `Updated ${date.toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}`;
  };
  const renderTrips = (target, drives, limit, musicState = "idle") => {
    $(target).innerHTML = drives.slice(0, limit).map((drive) => {
      const artist = drive.topArtist
        ? `<span class="trip-artist">Top artist: ${escape(drive.topArtist)}</span>`
        : musicState === "loading"
          ? '<span class="trip-artist trip-artist-loading">Music loading&hellip;</span>'
          : "";
      return `<button class="trip" type="button" data-wife-drive-id="${escape(drive.id)}" aria-label="Open read-only overview for ${escape(drive.shortDateLabel || drive.dateLabel)}"><strong>${escape(drive.shortDateLabel || drive.dateLabel)}</strong><span class="trip-route">${escape(drive.startingLocation || "Start")} &rarr; ${escape(drive.endingLocation || "Destination")}</span><span class="trip-meta">${escape(drive.miles ?? 0)} mi &middot; ${escape(drive.durationMinutes ?? 0)} min</span>${artist}</button>`;
    }).join("") || '<article class="trip"><strong>No recent trips yet</strong><span class="trip-meta">Trips will appear here after a drive.</span></article>';
  };
  let drives = [];
  let collections = [];
  let selectedDriveId = null;
  let detailReturnView = "tripsView";
  let detailMap = null;
  const safeHttpsUrl = (value) => { try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } };
  const renderCollections = () => {
    $("wifeCollections").innerHTML = collections.length ? collections.map((collection) => {
      const members = new Set(collection.driveIds || []);
      const collectionDrives = drives.filter((drive) => members.has(drive.id));
      const trips = collectionDrives.map((drive) => `<button class="trip wife-collection-trip" type="button" data-wife-drive-id="${escape(drive.id)}"><strong>${escape(drive.shortDateLabel || drive.dateLabel)}</strong><span class="trip-route">${escape(drive.startingLocation || "Start")} &rarr; ${escape(drive.endingLocation || "Destination")}</span><span class="trip-meta">${escape(drive.miles ?? 0)} mi &middot; ${escape(drive.durationMinutes ?? 0)} min</span></button>`).join("");
      return `<article class="wife-collection"><div class="wife-collection-heading"><div><strong>${escape(collection.name)}</strong><p>${escape(collection.description || "A shared journey collection")}</p></div><span>${members.size} drive${members.size === 1 ? "" : "s"}</span></div><div class="trip-list">${trips || '<div class="wife-collection-empty">No available drives in this collection.</div>'}</div></article>`;
    }).join("") : '<article class="wife-collection"><strong>No collections yet</strong><p>Collections created in Full JourneyDeck will appear here.</p></article>';
  };
  const detailMetric = (label, value) => `<div class="detail-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
  const formatMetric = (value, suffix) => value == null ? "—" : `${value}${suffix}`;
  const renderDriveDetail = () => {
    const drive = drives.find((item) => String(item.id) === String(selectedDriveId));
    if (!drive) return;
    $("wifeDetailTitle").textContent = drive.dateLabel || "Drive overview";
    $("wifeDetailTime").textContent = `${drive.startTime || ""} → ${drive.endTime || ""}`;
    $("wifeDetailStart").textContent = drive.startingLocation || "Start";
    $("wifeDetailEnd").textContent = drive.endingLocation || "Destination";
    $("wifeDetailMetrics").innerHTML = [
      detailMetric("Distance", formatMetric(drive.miles, " mi")),
      detailMetric("Duration", formatMetric(drive.durationMinutes, " min")),
      detailMetric("Battery", drive.startingBattery == null || drive.endingBattery == null ? "—" : `${drive.startingBattery}% → ${drive.endingBattery}%`),
      detailMetric("Average speed", formatMetric(drive.averageSpeed, " mph")),
      detailMetric("Max speed", formatMetric(drive.maxSpeed, " mph"))
    ].join("");
  };
  const renderWifeSongs = (songs) => {
    $("wifeDetailMusicTitle").textContent = `${songs.length} song${songs.length === 1 ? "" : "s"}`;
    $("wifeDetailMusic").innerHTML = songs.length ? songs.map((song) => {
      const artwork = safeHttpsUrl(song.albumImage);
      const spotify = safeHttpsUrl(song.spotifyUrl);
      const telemetry = [song.speed != null ? `${song.speed} mph` : "", song.battery != null ? `${song.battery}% battery` : "", song.offsetSeconds != null ? `GPS +/-${song.offsetSeconds}s` : "GPS unavailable"].filter(Boolean).join(" &middot; ");
      return `<article class="wife-song"><span class="wife-song-time">${escape(song.time || "")}</span>${artwork ? `<img class="wife-song-art" src="${escape(artwork)}" alt="">` : '<span class="wife-song-art" aria-hidden="true"></span>'}<span class="wife-song-number">${escape(song.index)}</span><div class="wife-song-copy"><strong>${escape(song.track || "Unknown song")}</strong><span>${escape(song.artist || "Unknown artist")}</span><span>${telemetry}</span>${spotify ? `<a href="${escape(spotify)}" target="_blank" rel="noopener noreferrer">&#9654; Play on Spotify</a>` : ""}</div></article>`;
    }).join("") : '<div class="detail-music-summary"><strong>No matched songs for this drive</strong><span>JourneyDeck did not find archived Spotify plays in this drive window.</span></div>';
  };
  const addWifeTerminalMarker = (map, point, type) => {
    if (point?.latitude == null || point?.longitude == null) return;
    const element = document.createElement("span");
    element.className = `wife-terminal-marker ${type}`;
    element.setAttribute("aria-label", type === "end" ? "Drive end" : "Drive start");
    new window.maplibregl.Marker({ element, anchor: "center" }).setLngLat([point.longitude, point.latitude]).addTo(map);
  };
  const renderWifeDriveMap = (data) => {
    const route = (data.routePoints || []).filter((point) => point.latitude != null && point.longitude != null);
    const songs = data.songMarkers || [];
    renderWifeSongs(songs);
    if (detailMap) { detailMap.remove(); detailMap = null; }
    if (!route.length || !window.maplibregl) {
      $("wifeDriveMap").innerHTML = `<span>${escape(data.message || "Route map is unavailable for this drive.")}</span>`;
      $("wifeDriveMapStatus").textContent = "No route GPS available";
      return;
    }
    $("wifeDriveMap").innerHTML = "";
    detailMap = new window.maplibregl.Map({ container: "wifeDriveMap", style: "https://tiles.openfreemap.org/styles/liberty", center: [route[0].longitude, route[0].latitude], zoom: 11, attributionControl: true });
    detailMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
    detailMap.on("load", () => {
      const coordinates = route.map((point) => [point.longitude, point.latitude]);
      detailMap.addSource("wife-drive-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } } });
      detailMap.addLayer({ id: "wife-drive-route-shadow", type: "line", source: "wife-drive-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#6f294a", "line-width": 8, "line-opacity": .3 } });
      detailMap.addLayer({ id: "wife-drive-route-line", type: "line", source: "wife-drive-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#df6f9d", "line-width": 4, "line-opacity": .95 } });
      addWifeTerminalMarker(detailMap, data.startMarker, "start");
      addWifeTerminalMarker(detailMap, data.endMarker, "end");
      songs.forEach((song) => {
        if (song.latitude == null || song.longitude == null) return;
        const element = document.createElement("button");
        element.type = "button";
        element.className = "wife-song-marker";
        element.textContent = song.index;
        element.setAttribute("aria-label", `Song ${song.index}: ${song.track}`);
        const popup = new window.maplibregl.Popup({ offset: 18 }).setHTML(`<div class="wife-map-popup"><strong>${escape(song.index)}. ${escape(song.track)}</strong><span>${escape(song.artist)}</span><span>${escape(song.time)}</span></div>`);
        new window.maplibregl.Marker({ element, anchor: "center" }).setLngLat([song.longitude, song.latitude]).setPopup(popup).addTo(detailMap);
      });
      const bounds = coordinates.reduce((box, coordinate) => box.extend(coordinate), new window.maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
      detailMap.fitBounds(bounds, { padding: 36, maxZoom: 14, duration: 0 });
      const located = songs.filter((song) => song.latitude != null && song.longitude != null).length;
      $("wifeDriveMapStatus").textContent = `${route.length} route points - ${located}/${songs.length} songs located`;
    });
  };
  const loadWifeDriveMap = async (driveId) => {
    $("wifeDriveMapStatus").textContent = "Loading route...";
    $("wifeDriveMap").innerHTML = "<span>Loading drive map...</span>";
    $("wifeDetailMusic").innerHTML = '<div class="detail-music-summary"><strong>Loading songs...</strong></div>';
    try {
      const data = await request("/api/wife/drive/map", { method: "POST", body: JSON.stringify({ driveId }) });
      if (String(selectedDriveId) !== String(driveId)) return;
      renderWifeDriveMap(data);
    } catch {
      $("wifeDriveMap").innerHTML = "<span>Drive map could not load right now.</span>";
      $("wifeDriveMapStatus").textContent = "Map unavailable";
      $("wifeDetailMusic").innerHTML = '<div class="detail-music-summary"><strong>Song list could not load right now</strong></div>';
    }
  };
  const activate = (id) => {
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
    document.querySelectorAll(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openDriveDetail = (driveId, returnView) => {
    selectedDriveId = driveId;
    detailReturnView = returnView || "tripsView";
    renderDriveDetail();
    activate("tripDetailView");
    setTimeout(() => loadWifeDriveMap(driveId), 40);
  };
  const showMap = (latitude, longitude) => {
    const mapElement = $("wifeMap");
    if (!window.maplibregl) { $("wifeLocationText").textContent = "Map could not load right now"; return; }
    mapElement.innerHTML = "";
    const map = new window.maplibregl.Map({ container: mapElement, style: "https://tiles.openfreemap.org/styles/liberty", center: [longitude, latitude], zoom: 13, attributionControl: false });
    map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
    new window.maplibregl.Marker({ color: "#df6f9d" }).setLngLat([longitude, latitude]).addTo(map);
  };
  const setStatus = (message, state = "loading") => {
    const status = $("wifeLoadStatus");
    status.classList.toggle("ready", state === "ready");
    status.classList.toggle("error", state === "error");
    status.querySelector("span").textContent = message;
  };
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => activate(button.dataset.view)));
  ["wifeRecentHome", "wifeTrips", "wifeCollections"].forEach((id) => $(id).addEventListener("click", (event) => {
    const trip = event.target.closest("[data-wife-drive-id]");
    if (!trip) return;
    openDriveDetail(trip.dataset.wifeDriveId, id === "wifeRecentHome" ? "homeView" : id === "wifeCollections" ? "collectionsView" : "tripsView");
  }));
  $("wifeDetailBack").addEventListener("click", () => activate(detailReturnView));
  $("themeToggle").addEventListener("click", () => { const dark = document.documentElement.dataset.theme !== "dark"; document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("journeydeck-wife-theme", document.documentElement.dataset.theme); });
  document.documentElement.dataset.theme = localStorage.getItem("journeydeck-wife-theme") || "light";
  $("openFull").addEventListener("click", async () => { try { $("openFull").disabled = true; await request("/api/wife/mode", { method: "POST", body: JSON.stringify({ mode: "full" }) }); location.replace("/"); } catch { $("openFull").disabled = false; } });
  $("wifeSignOut").addEventListener("click", async () => { try { $("wifeSignOut").disabled = true; await request("/api/auth/logout", { method: "POST", body: "{}" }); location.replace("/login"); } catch { $("wifeSignOut").disabled = false; } });
  void (async () => {
    let failures = 0;
    let vehicleReady = false;
    let drivesReady = false;
    setStatus("Checking your car...");

    const vehiclePromise = request("/api/wife/vehicle").then((vehicle) => {
      $("wifeVehicleName").textContent = vehicle.name || "Your car";
      $("wifeBattery").textContent = `${vehicle.battery ?? "-"}%`;
      $("wifeRange").textContent = vehicle.rangeMiles == null ? "- mi" : `${Math.round(vehicle.rangeMiles)} mi`;
      $("wifeUpdated").textContent = displayUpdated(vehicle.gpsAsOf);
      vehicleReady = true;
      if (!drivesReady) setStatus("Car ready - loading trips...");
    }).catch(() => { failures += 1; $("wifeUpdated").textContent = "Car status is taking longer than usual"; });

    const drivesPromise = request("/api/wife/drives").then((data) => {
      drives = data.drives || [];
      $("wifeTodayMiles").textContent = data.today?.miles ?? 0;
      $("wifeTodayTrips").textContent = data.today?.trips ?? 0;
      renderTrips("wifeRecentHome", drives, 3, "loading");
      renderTrips("wifeTrips", drives, 20, "loading");
      drivesReady = true;
      if (!vehicleReady) setStatus("Trips ready - checking your car...");
    }).catch(() => { failures += 1; renderTrips("wifeRecentHome", [], 3); renderTrips("wifeTrips", [], 20); });

    const collectionsPromise = request("/api/wife/collections").then((data) => { collections = data.collections || []; renderCollections(); }).catch(() => { failures += 1; collections = []; renderCollections(); });

    await Promise.allSettled([vehiclePromise, drivesPromise, collectionsPromise]);
    renderCollections();
    setStatus(failures ? "Core drive data ready" : "Drive data ready", "ready");
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    void request("/api/wife/music").then((data) => {
      const music = new Map((data.drives || []).map((drive) => [drive.id, drive]));
      drives = drives.map((drive) => ({ ...drive, topArtist: music.get(drive.id)?.topArtist || null, songCount: music.get(drive.id)?.songCount ?? 0 }));
      renderTrips("wifeRecentHome", drives, 3);
      renderTrips("wifeTrips", drives, 20);
      renderCollections();
      if (selectedDriveId) renderDriveDetail();
      setStatus("Everything is up to date", "ready");
    }).catch(() => {
      renderTrips("wifeRecentHome", drives, 3);
      renderTrips("wifeTrips", drives, 20);
      renderCollections();
    });

    void request("/api/wife/live").then((live) => {
      if (live.latitude != null && live.longitude != null) showMap(Number(live.latitude), Number(live.longitude));
      else $("wifeLocationText").textContent = "Location is not available right now";
    }).catch(() => { $("wifeLocationText").textContent = "Location is taking longer than usual"; });
  })();
})();
