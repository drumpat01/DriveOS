(function () {
  const byId = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  let activityHome = null;
  let activityMonitor = null;
  let logoHoldTimer = 0;
  let logoHoldActivated = false;
  let logoHoldStartX = 0;
  let logoHoldStartY = 0;
  let liveStatus = null;
  let liveVehicle = null;
  let liveSpotify = null;
  let liveDrives = null;

  function dashboardIsActive() {
    return byId("view-dashboard")?.classList.contains("active-view");
  }

  function syncBodyMode() {
    document.body.classList.toggle("reference-dashboard-active", Boolean(dashboardIsActive()));
  }

  function mobileDashboardIsActive() {
    return dashboardIsActive() && window.matchMedia("(max-width: 767px)").matches;
  }

  function syncActivityCopy(inDashboard) {
    if (!activityMonitor) return;
    const text = byId("backgroundActivityText");
    const count = byId("backgroundActivityCount");
    if (activityMonitor.classList.contains("idle")) {
      if (text) text.textContent = inDashboard ? "All caught up" : "Idle";
      return;
    }
    if (!count || count.hidden) return;
    const total = Number.parseInt(count.textContent, 10);
    if (!Number.isFinite(total)) return;
    count.textContent = inDashboard ? `${total} activities` : String(total);
  }

  function syncActivityPlacement() {
    activityMonitor ||= byId("backgroundActivityMonitor");
    const slot = document.querySelector("[data-ref-activity-slot]");
    if (!activityMonitor || !slot) return;
    if (!activityHome) {
      activityHome = document.createComment("background activity home");
      activityMonitor.parentNode?.insertBefore(activityHome, activityMonitor);
    }
    const useDashboardSlot = mobileDashboardIsActive();
    if (useDashboardSlot && activityMonitor.parentElement !== slot) slot.appendChild(activityMonitor);
    if (!useDashboardSlot && activityHome.parentNode && activityMonitor.parentElement === slot) {
      activityHome.parentNode.insertBefore(activityMonitor, activityHome.nextSibling);
    }
    activityMonitor.classList.toggle("ref-dashboard-activity", useDashboardSlot);
    syncActivityCopy(useDashboardSlot);
  }

  function openAnimationLab() {
    const build = encodeURIComponent(window.DriveOSBuild?.webBuild || "current");
    window.location.assign(`/loading-preview.html?v=${build}`);
  }

  function cancelLogoHold() {
    window.clearTimeout(logoHoldTimer);
    logoHoldTimer = 0;
    document.querySelector(".ref-hero")?.classList.remove("is-holding");
  }

  function beginLogoHold(event) {
    if (event.type === "pointerdown" && event.button !== 0) return;
    if (event.target?.closest?.(".ref-live-pill")) return;
    cancelLogoHold();
    logoHoldActivated = false;
    const point = event.touches?.[0] || event;
    logoHoldStartX = Number(point.clientX) || 0;
    logoHoldStartY = Number(point.clientY) || 0;
    const hero = event.currentTarget;
    hero.classList.add("is-holding");
    logoHoldTimer = window.setTimeout(() => {
      logoHoldActivated = true;
      hero.classList.remove("is-holding");
      navigator.vibrate?.(35);
      openAnimationLab();
    }, 1500);
  }

  function trackLogoHold(event) {
    if (!logoHoldTimer) return;
    const point = event.touches?.[0] || event;
    if (Math.hypot((Number(point.clientX) || 0) - logoHoldStartX, (Number(point.clientY) || 0) - logoHoldStartY) > 12) {
      cancelLogoHold();
    }
  }

  function bindAnimationLabHold() {
    const hero = document.querySelector(".ref-hero");
    if (!hero || hero.dataset.animationHoldBound === "true") return;
    hero.dataset.animationHoldBound = "true";
    if ("PointerEvent" in window) {
      hero.addEventListener("pointerdown", beginLogoHold);
      hero.addEventListener("pointermove", trackLogoHold, { passive: true });
      ["pointerup", "pointercancel", "pointerleave"].forEach(type => hero.addEventListener(type, cancelLogoHold));
    } else {
      hero.addEventListener("touchstart", beginLogoHold, { passive: true });
      hero.addEventListener("touchmove", trackLogoHold, { passive: true });
      ["touchend", "touchcancel"].forEach(type => hero.addEventListener(type, cancelLogoHold));
    }
    hero.addEventListener("contextmenu", event => event.preventDefault());
    hero.addEventListener("click", event => {
      if (!logoHoldActivated) return;
      event.preventDefault();
      logoHoldActivated = false;
    });
  }

  function syncBuildLabel() {
    const build = window.DriveOSBuild?.webBuild || document.documentElement.dataset.webBuild || "current";
    all("[data-ref-build]").forEach(node => { node.textContent = build; });
  }

  function syncToolDock(view = dashboardIsActive() ? "dashboard" : "") {
    all(".ref-tool-dock [data-go-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.goView === view);
    });
  }

  function numericText(element, fallback) {
    const match = String(element?.textContent || "").match(/[\d,.]+/);
    return match ? match[0] : fallback;
  }

  function connectionLabel(element) {
    const value = String(element?.textContent || "").trim().toLowerCase();
    if (!value || value === "--" || value.includes("checking")) return "Checking";
    if (value.includes("connect") || value.includes("online") || value.includes("ready")) return "Connected";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function sourceText(id, fallback) {
    const value = String(byId(id)?.textContent || "").trim();
    return value && value !== "--" ? value : fallback;
  }

  function formatMinutes(value) {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function driveDateKey(drive) {
    if (drive?.dateIso) return String(drive.dateIso).slice(0, 10);
    const date = new Date(drive?.startedAt || drive?.endedAt || 0);
    return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
  }

  function renderStatus(status) {
    if (!status) return;
    all("[data-ref-tessie]").forEach(node => { node.textContent = status.tessie ? "Connected" : "Unavailable"; });
    all("[data-ref-spotify]").forEach(node => { node.textContent = status.spotify ? "Connected" : "Connect"; });
  }

  function renderVehicle(vehicle) {
    if (!vehicle) return;
    const battery = Number.isFinite(Number(vehicle.battery)) ? String(Math.round(Number(vehicle.battery))) : "--";
    const range = Number.isFinite(Number(vehicle.rangeMiles)) ? String(Math.round(Number(vehicle.rangeMiles))) : "--";
    all("[data-ref-battery]").forEach(node => { node.textContent = battery; });
    all("[data-ref-range]").forEach(node => { node.textContent = range; });
    all("[data-ref-vehicle-state]").forEach(node => { node.textContent = String(vehicle.state || "Unavailable"); });
    all("[data-ref-charge-limit]").forEach(node => { node.textContent = Number.isFinite(Number(vehicle.chargeLimit)) ? String(Math.round(Number(vehicle.chargeLimit))) : "--"; });
    all("[data-ref-inside-temp]").forEach(node => { node.textContent = Number.isFinite(Number(vehicle.insideTempF)) ? String(Math.round(Number(vehicle.insideTempF))) : "--"; });
    all("[data-ref-outside-temp]").forEach(node => { node.textContent = Number.isFinite(Number(vehicle.outsideTempF)) ? String(Math.round(Number(vehicle.outsideTempF))) : "--"; });
    const batteryLevel = Math.max(0, Math.min(100, Number(battery) || 0));
    all(".ref-battery-bars b").forEach((bar, index, bars) => {
      const segmentStart = index * (100 / bars.length);
      const fill = Math.max(0, Math.min(100, (batteryLevel - segmentStart) / (100 / bars.length) * 100));
      bar.style.setProperty("--segment-fill", `${fill}%`);
    });
  }

  function renderSpotify(data) {
    const featured = Array.isArray(data?.recent) ? data.recent.find(Boolean) : null;
    if (!featured) {
      all("[data-ref-track]").forEach(node => { node.textContent = "No recent Spotify plays"; });
      all("[data-ref-artist]").forEach(node => { node.textContent = "Play something to update this card"; });
      return;
    }
    all("[data-ref-track]").forEach(node => { node.textContent = featured.track || "Unknown track"; });
    all("[data-ref-artist]").forEach(node => { node.textContent = featured.artist || "Unknown artist"; });
    all("[data-ref-elapsed]").forEach(node => { node.textContent = featured.time || "Recent"; });
    const album = document.querySelector("[data-ref-album]");
    if (album && featured.albumImage) {
      album.style.backgroundImage = `linear-gradient(145deg, rgba(20, 5, 42, .14), rgba(255, 49, 95, .16)), url(${JSON.stringify(String(featured.albumImage))})`;
      album.classList.add("has-live-artwork");
    }
  }

  function renderDriveData(drives) {
    const collection = Array.isArray(drives) ? drives.filter(Boolean) : [];
    const sorted = [...collection].sort((left, right) => new Date(right.endedAt || right.startedAt || 0) - new Date(left.endedAt || left.startedAt || 0));
    const today = collection.filter(drive => driveDateKey(drive) === localDateKey());
    const miles = today.reduce((total, drive) => total + (Number(drive.miles) || 0), 0);
    const minutes = today.reduce((total, drive) => total + (Number(drive.durationMinutes) || 0), 0);
    const energy = today.reduce((total, drive) => total + (Number(drive.energyKWh) || 0), 0);
    const weightedEfficiency = today.reduce((total, drive) => total + (Number(drive.efficiencyWhMi) || 0) * (Number(drive.miles) || 0), 0);
    const efficiency = miles > 0 ? Math.round(energy > 0 ? energy * 1000 / miles : weightedEfficiency / miles) : null;
    const milesLabel = miles.toFixed(1).replace(/\.0$/, "");
    all("[data-ref-miles]").forEach(node => { node.innerHTML = `${milesLabel}<small> mi</small>`; });
    all("[data-ref-trips]").forEach(node => { node.textContent = String(today.length); });
    all("[data-ref-time]").forEach(node => { node.textContent = formatMinutes(minutes); });
    all("[data-ref-efficiency]").forEach(node => { node.textContent = efficiency == null ? "--" : String(efficiency); });

    const progress = document.querySelector(".ref-score-progress");
    const efficiencyScore = efficiency == null ? 0 : Math.max(0, Math.min(1, (400 - efficiency) / 250));
    if (progress) progress.style.strokeDashoffset = String(239 * (1 - efficiencyScore));

    const latest = sorted[0];
    if (latest) {
      all("[data-ref-latest-origin]").forEach(node => { node.textContent = latest.startingLocation || "Journey start"; });
      all("[data-ref-latest-destination]").forEach(node => { node.textContent = latest.endingLocation || "Journey end"; });
      all("[data-ref-latest-meta]").forEach(node => {
        node.textContent = [latest.shortDateLabel || latest.dateLabel, Number.isFinite(Number(latest.miles)) ? `${Number(latest.miles).toFixed(1)} mi` : null, Number.isFinite(Number(latest.durationMinutes)) ? formatMinutes(latest.durationMinutes) : null].filter(Boolean).join(" · ");
      });
    }

    all("[data-reference-drive]").forEach((row, index) => {
      const drive = sorted[index];
      if (!drive) return;
      const originNode = row.querySelector("[data-ref-journey-origin]");
      const destinationNode = row.querySelector("[data-ref-journey-destination]");
      const metaNode = row.querySelector("[data-ref-journey-meta]");
      if (originNode) originNode.textContent = drive.startingLocation || "Journey";
      if (destinationNode) destinationNode.textContent = drive.endingLocation || "Recent journey";
      if (metaNode) metaNode.textContent = [Number.isFinite(Number(drive.miles)) ? `${Number(drive.miles).toFixed(1)} mi` : null, Number.isFinite(Number(drive.durationMinutes)) ? formatMinutes(drive.durationMinutes) : null, drive.startTime || null].filter(Boolean).join(" · ");
    });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const week = collection.filter(drive => new Date(drive.startedAt || drive.endedAt || 0) >= weekStart);
    const weekMiles = week.reduce((total, drive) => total + (Number(drive.miles) || 0), 0);
    const weekMinutes = week.reduce((total, drive) => total + (Number(drive.durationMinutes) || 0), 0);
    const weekSongs = week.reduce((total, drive) => total + (Number(drive.songCount) || (drive.soundtrack || []).length), 0);
    all("[data-ref-week-miles]").forEach(node => { node.textContent = weekMiles.toFixed(1).replace(/\.0$/, ""); });
    all("[data-ref-week-drives]").forEach(node => { node.textContent = String(week.length); });
    all("[data-ref-week-time]").forEach(node => { node.textContent = formatMinutes(weekMinutes); });
    all("[data-ref-week-songs]").forEach(node => { node.textContent = String(weekSongs); });
  }

  function syncMusic() {
    const featured = byId("trackList")?.querySelector(".v3-now-playing");
    if (!featured) return;
    const track = featured.querySelector(".v3-featured-title")?.textContent?.trim();
    const artist = featured.querySelector(".v3-featured-artist")?.textContent?.trim();
    const artwork = featured.querySelector("img")?.getAttribute("src");
    const playedTime = featured.querySelector(".v3-featured-time")?.textContent?.trim();
    if (track) all("[data-ref-track]").forEach(node => { node.textContent = track; });
    if (artist) all("[data-ref-artist]").forEach(node => { node.textContent = artist; });
    const album = document.querySelector("[data-ref-album]");
    if (album && artwork) {
      album.style.backgroundImage = `linear-gradient(145deg, rgba(20, 5, 42, .14), rgba(255, 49, 95, .16)), url(${JSON.stringify(artwork)})`;
      album.classList.add("has-live-artwork");
    }
    if (playedTime) all("[data-ref-elapsed]").forEach(node => { node.textContent = playedTime; });
  }

  function syncToday() {
    const miles = numericText(byId("todayDrivingMiles"), "0");
    const trips = numericText(byId("todayDrivingTrips"), "0");
    const time = sourceText("todayDrivingTime", "0 min");
    const efficiency = numericText(byId("todayDrivingEfficiency"), "--");
    all("[data-ref-miles]").forEach(node => { node.innerHTML = `${miles}<small> mi</small>`; });
    all("[data-ref-trips]").forEach(node => { node.textContent = trips; });
    all("[data-ref-time]").forEach(node => { node.textContent = time; });
    all("[data-ref-efficiency]").forEach(node => { node.textContent = efficiency; });
    const efficiencyValue = Number(String(byId("todayDrivingEfficiency")?.textContent || "").match(/[\d,.]+/)?.[0]?.replace(",", ""));
    const efficiencyScore = Number.isFinite(efficiencyValue) ? Math.max(0, Math.min(1, (400 - efficiencyValue) / 250)) : 0;
    const progress = document.querySelector(".ref-score-progress");
    if (progress) progress.style.strokeDashoffset = String(239 * (1 - efficiencyScore));
  }

  function syncJourneys() {
    const sourceCards = all("#dashboardDrives .dashboard-drive-card");
    all("[data-reference-drive]").forEach((row, index) => {
      const source = sourceCards[index];
      if (!source) return;
      const cities = [...source.querySelectorAll(".dashboard-route-city")];
      const origin = cities[0]?.textContent?.trim() || "Journey";
      const destination = cities[1]?.textContent?.trim() || "Recent journey";
      const stats = [...source.querySelectorAll(".drive-stat strong")].map(node => node.textContent.trim());
      const time = source.querySelector(".drive-main-heading span")?.textContent?.trim().split("→")[0]?.trim() || "";
      const originNode = row.querySelector("[data-ref-journey-origin]");
      const destinationNode = row.querySelector("[data-ref-journey-destination]");
      const metaNode = row.querySelector("[data-ref-journey-meta]");
      if (originNode) originNode.textContent = origin;
      if (destinationNode) destinationNode.textContent = destination;
      if (metaNode) metaNode.textContent = [stats[0], stats[1], time].filter(Boolean).join(" · ");
    });
  }

  function syncLiveData() {
    if (liveStatus) renderStatus(liveStatus);
    if (liveVehicle) renderVehicle(liveVehicle);
    if (liveSpotify) renderSpotify(liveSpotify);
    if (liveDrives) renderDriveData(liveDrives);
    const battery = numericText(byId("batteryValue"), "72");
    const range = numericText(byId("rangeMiles"), "185");
    all("[data-ref-battery]").forEach(node => { node.textContent = battery; });
    all("[data-ref-range]").forEach(node => { node.textContent = range; });
    all("[data-ref-tessie]").forEach(node => { node.textContent = connectionLabel(byId("tessieStatus")); });
    all("[data-ref-spotify]").forEach(node => { node.textContent = connectionLabel(byId("spotifyStatus")); });
    all("[data-ref-vehicle-state]").forEach(node => { node.textContent = sourceText("vehicleState", "Checking Tessie"); });
    all("[data-ref-charge-limit]").forEach(node => { node.textContent = numericText(byId("chargeLimit"), "--"); });
    all("[data-ref-inside-temp]").forEach(node => { node.textContent = numericText(byId("insideTemp"), "--"); });
    all("[data-ref-outside-temp]").forEach(node => { node.textContent = numericText(byId("outsideTemp"), "--"); });
    const batteryLevel = Math.max(0, Math.min(100, Number(battery) || 0));
    all(".ref-battery-bars b").forEach((bar, index, bars) => {
      const segmentStart = index * (100 / bars.length);
      const fill = Math.max(0, Math.min(100, (batteryLevel - segmentStart) / (100 / bars.length) * 100));
      bar.style.setProperty("--segment-fill", `${fill}%`);
    });
    if (!liveSpotify) syncMusic();
    if (!liveDrives) {
      syncToday();
      syncJourneys();
    }
  }

  function setStatus(status) {
    liveStatus = status || null;
    renderStatus(liveStatus);
  }

  function setVehicle(vehicle) {
    liveVehicle = vehicle || null;
    renderVehicle(liveVehicle);
  }

  function setSpotify(data) {
    liveSpotify = data || { recent: [] };
    renderSpotify(liveSpotify);
  }

  function setDrives(drives) {
    liveDrives = Array.isArray(drives) ? drives.filter(Boolean) : [];
    renderDriveData(liveDrives);
  }

  function openReferenceDrive(index) {
    const driveCards = all("#dashboardDrives [data-drive-card-id]");
    if (driveCards[index]) {
      driveCards[index].click();
      return;
    }
    window.DriveOSNavigation?.showView("drives");
  }

  function bind() {
    syncBodyMode();
    syncLiveData();
    syncBuildLabel();
    syncActivityPlacement();
    bindAnimationLabHold();

    document.addEventListener("journeydeck:viewchange", event => {
      document.body.classList.toggle("reference-dashboard-active", event.detail?.view === "dashboard");
      syncToolDock(event.detail?.view || "");
      syncActivityPlacement();
    });
    window.addEventListener("resize", syncActivityPlacement, { passive: true });

    syncToolDock();

    all("[data-reference-drive]").forEach(button => {
      button.addEventListener("click", () => openReferenceDrive(Number(button.dataset.referenceDrive) || 0));
    });

    all("[data-reference-health]").forEach(button => {
      button.addEventListener("click", () => {
        const destination = button.dataset.referenceHealth === "spotify" ? "music" : "health";
        window.DriveOSNavigation?.showView(destination);
      });
    });

    const sourceNodes = ["batteryValue", "rangeMiles", "chargeLimit", "insideTemp", "outsideTemp", "vehicleState", "tessieStatus", "spotifyStatus", "todayDrivingMiles", "todayDrivingTrips", "todayDrivingTime", "todayDrivingEfficiency", "trackList", "dashboardDrives"]
      .map(byId)
      .filter(Boolean);
    if (sourceNodes.length) {
      const observer = new MutationObserver(syncLiveData);
      sourceNodes.forEach(node => observer.observe(node, { childList: true, characterData: true, subtree: true }));
    }
  }

  window.DriveOSReferenceDashboard = Object.freeze({ setStatus, setVehicle, setSpotify, setDrives, refresh: syncLiveData });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
