(function () {
  const byId = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  let elapsedSeconds = 84;
  let playerTimer = null;

  function dashboardIsActive() {
    return byId("view-dashboard")?.classList.contains("active-view");
  }

  function syncBodyMode() {
    document.body.classList.toggle("reference-dashboard-active", Boolean(dashboardIsActive()));
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

  function syncMusic() {
    const featured = byId("trackList")?.querySelector(".v3-now-playing");
    if (!featured) return;
    const track = featured.querySelector(".v3-featured-title")?.textContent?.trim();
    const artist = featured.querySelector(".v3-featured-artist")?.textContent?.trim();
    const artwork = featured.querySelector("img")?.getAttribute("src");
    if (track) all("[data-ref-track]").forEach(node => { node.textContent = track; });
    if (artist) all("[data-ref-artist]").forEach(node => { node.textContent = artist; });
    const album = document.querySelector("[data-ref-album]");
    if (album && artwork) {
      album.style.backgroundImage = `linear-gradient(145deg, rgba(20, 5, 42, .14), rgba(255, 49, 95, .16)), url(${JSON.stringify(artwork)})`;
      album.classList.add("has-live-artwork");
    }
    const button = document.querySelector("[data-reference-player]");
    if (button && track) button.setAttribute("aria-label", `${button.classList.contains("is-playing") ? "Pause" : "Play"} ${track}`);
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
  }

  function syncJourneys() {
    const sourceCards = all("#dashboardDrives .dashboard-drive-card");
    all("[data-reference-drive]").forEach((row, index) => {
      const source = sourceCards[index];
      if (!source) return;
      const cities = [...source.querySelectorAll(".dashboard-route-city")];
      const origin = cities[0]?.textContent?.trim() || "Journey";
      const destination = cities[1]?.textContent?.trim() || "Recent drive";
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
    const battery = numericText(byId("batteryValue"), "72");
    const range = numericText(byId("rangeMiles"), "185");
    all("[data-ref-battery]").forEach(node => { node.textContent = battery; });
    all("[data-ref-range]").forEach(node => { node.textContent = range; });
    all("[data-ref-tessie]").forEach(node => { node.textContent = connectionLabel(byId("tessieStatus")); });
    all("[data-ref-spotify]").forEach(node => { node.textContent = connectionLabel(byId("spotifyStatus")); });
    syncMusic();
    syncToday();
    syncJourneys();
  }

  function formatTime(value) {
    const minutes = Math.floor(value / 60);
    const seconds = String(value % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function setPlayerState(playing) {
    const button = document.querySelector("[data-reference-player]");
    const card = document.querySelector(".ref-music-card");
    if (!button || !card) return;
    button.classList.toggle("is-playing", playing);
    card.classList.toggle("is-paused", !playing);
    const track = document.querySelector("[data-ref-track]")?.textContent?.trim() || "recent track";
    button.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${track}`);
    window.clearInterval(playerTimer);
    playerTimer = null;
    if (!playing) return;
    playerTimer = window.setInterval(() => {
      elapsedSeconds = elapsedSeconds >= 238 ? 0 : elapsedSeconds + 1;
      all("[data-ref-elapsed]").forEach(node => { node.textContent = formatTime(elapsedSeconds); });
    }, 1000);
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

    document.addEventListener("journeydeck:viewchange", event => {
      document.body.classList.toggle("reference-dashboard-active", event.detail?.view === "dashboard");
    });

    document.querySelector("[data-reference-player]")?.addEventListener("click", event => {
      setPlayerState(!event.currentTarget.classList.contains("is-playing"));
    });

    all("[data-reference-drive]").forEach(button => {
      button.addEventListener("click", () => openReferenceDrive(Number(button.dataset.referenceDrive) || 0));
    });

    all("[data-reference-health]").forEach(button => {
      button.addEventListener("click", () => {
        const destination = button.dataset.referenceHealth === "spotify" ? "music" : "health";
        window.DriveOSNavigation?.showView(destination);
      });
    });

    const sourceNodes = ["batteryValue", "rangeMiles", "tessieStatus", "spotifyStatus", "todayDrivingMiles", "todayDrivingTrips", "todayDrivingTime", "todayDrivingEfficiency", "trackList", "dashboardDrives"]
      .map(byId)
      .filter(Boolean);
    if (sourceNodes.length) {
      const observer = new MutationObserver(syncLiveData);
      sourceNodes.forEach(node => observer.observe(node, { childList: true, characterData: true, subtree: true }));
    }

    setPlayerState(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
