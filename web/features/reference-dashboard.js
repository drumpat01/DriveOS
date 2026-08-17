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
    if (!value || value === "--" || value.includes("checking")) return "Connected";
    if (value.includes("connect") || value.includes("online") || value.includes("ready")) return "Connected";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function syncLiveData() {
    const battery = numericText(byId("batteryValue"), "72");
    const range = numericText(byId("rangeMiles"), "185");
    all("[data-ref-battery]").forEach(node => { node.textContent = battery; });
    all("[data-ref-range]").forEach(node => { node.textContent = range; });
    all("[data-ref-tessie]").forEach(node => { node.textContent = connectionLabel(byId("tessieStatus")); });
    all("[data-ref-spotify]").forEach(node => { node.textContent = connectionLabel(byId("spotifyStatus")); });
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
    button.setAttribute("aria-label", `${playing ? "Pause" : "Play"} Open Roads`);
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

    const sourceNodes = ["batteryValue", "rangeMiles", "tessieStatus", "spotifyStatus"]
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
