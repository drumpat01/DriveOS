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
  const renderTrips = (target, drives, limit) => {
    $(target).innerHTML = drives.slice(0, limit).map((drive) => `<article class="trip"><strong>${escape(drive.shortDateLabel || drive.dateLabel)}</strong><span class="trip-route">${escape(drive.startingLocation || "Start")} &rarr; ${escape(drive.endingLocation || "Destination")}</span><span class="trip-meta">${escape(drive.miles ?? 0)} mi &middot; ${escape(drive.durationMinutes ?? 0)} min</span>${drive.topArtist ? `<span class="trip-artist">Top artist: ${escape(drive.topArtist)}</span>` : ""}</article>`).join("") || '<article class="trip"><strong>No recent trips yet</strong><span class="trip-meta">Trips will appear here after a drive.</span></article>';
  };
  const activate = (id) => {
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
    document.querySelectorAll(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const showMap = (latitude, longitude) => {
    const mapElement = $("wifeMap");
    if (!window.maplibregl) { $("wifeLocationText").textContent = "Map could not load right now"; return; }
    mapElement.innerHTML = "";
    const map = new window.maplibregl.Map({ container: mapElement, style: "https://tiles.openfreemap.org/styles/liberty", center: [longitude, latitude], zoom: 13, attributionControl: false });
    map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
    new window.maplibregl.Marker({ color: "#df6f9d" }).setLngLat([longitude, latitude]).addTo(map);
  };
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => activate(button.dataset.view)));
  $("themeToggle").addEventListener("click", () => { const dark = document.documentElement.dataset.theme !== "dark"; document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("journeydeck-wife-theme", document.documentElement.dataset.theme); });
  document.documentElement.dataset.theme = localStorage.getItem("journeydeck-wife-theme") || "light";
  $("openFull").addEventListener("click", async () => { try { $("openFull").disabled = true; await request("/api/wife/mode", { method: "POST", body: JSON.stringify({ mode: "full" }) }); location.replace("/"); } catch { $("openFull").disabled = false; } });
  Promise.all([request("/api/auth/session"), request("/api/wife/summary"), request("/api/wife/live")]).then(([, summary, live]) => {
    $("wifeVehicleName").textContent = summary.vehicle.name || "Your car";
    $("wifeBattery").textContent = `${summary.vehicle.battery ?? "-"}%`;
    $("wifeRange").textContent = summary.vehicle.rangeMiles == null ? "- mi" : `${Math.round(summary.vehicle.rangeMiles)} mi`;
    $("wifeTodayMiles").textContent = summary.today.miles ?? 0;
    $("wifeTodayTrips").textContent = summary.today.trips ?? 0;
    $("wifeUpdated").textContent = displayUpdated(summary.vehicle.gpsAsOf);
    renderTrips("wifeRecentHome", summary.drives, 3);
    renderTrips("wifeTrips", summary.drives, 20);
    if (live.latitude != null && live.longitude != null) showMap(Number(live.latitude), Number(live.longitude));
    else $("wifeLocationText").textContent = "Location is not available right now";
  }).catch(() => { $("wifeUpdated").textContent = "JourneyDeck could not refresh right now"; });
})();
