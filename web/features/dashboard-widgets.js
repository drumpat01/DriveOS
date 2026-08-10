(function () {
  const $ = window.DriveOSDom.byId;
  const escapeHtml = window.DriveOSDom.escapeHtml;
  const setText = window.DriveOSDom.setText;

  function create({ state, artworkMarkup, actions }) {
    const recentDriveCount = 10;

    function localDateKey(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function driveDateKey(drive) {
      if (drive.dateIso) return String(drive.dateIso).slice(0, 10);
      const date = new Date(drive.startedAt);
      return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
    }

    function formatMinutes(value) {
      const minutes = Math.max(0, Math.round(Number(value) || 0));
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
    }

    function todaySummary() {
      const drives = state.drives.filter(drive => driveDateKey(drive) === localDateKey());
      const miles = drives.reduce((total, drive) => total + (Number(drive.miles) || 0), 0);
      const minutes = drives.reduce((total, drive) => total + (Number(drive.durationMinutes) || 0), 0);
      const songs = drives.reduce((total, drive) => total + (Number(drive.songCount) || (drive.soundtrack || []).length), 0);
      const energy = drives.reduce((total, drive) => total + (Number(drive.energyKWh) || 0), 0);
      const weightedEfficiency = drives.reduce((total, drive) => total + (Number(drive.efficiencyWhMi) || 0) * (Number(drive.miles) || 0), 0);
      const efficiency = miles > 0 ? Math.round(energy > 0 ? energy * 1000 / miles : weightedEfficiency / miles) : null;
      return { drives, miles, minutes, songs, efficiency };
    }

    function renderToday() {
      const summary = todaySummary();
      setText("todayDrivingMiles", summary.miles.toFixed(1).replace(/\.0$/, ""), "0");
      setText("todayDrivingTime", formatMinutes(summary.minutes), "0 min");
      setText("todayDrivingEfficiency", summary.efficiency == null ? "--" : `${summary.efficiency} Wh/mi`, "--");
      setText("todayDrivingTrips", summary.drives.length, "0");
      setText("todayDrivingSongs", summary.songs, "0");
      setText("todayDrivingStatus", summary.drives.length
        ? `${summary.drives.length} completed trip${summary.drives.length === 1 ? "" : "s"} today`
        : "No trips recorded yet today");
    }

    function topGroup(items, keyFor) {
      const groups = new Map();
      items.forEach(item => {
        const key = keyFor(item);
        if (!key) return;
        const group = groups.get(key) || { count: 0, item };
        group.count += 1;
        groups.set(key, group);
      });
      return [...groups.values()].sort((a, b) => b.count - a.count)[0] || null;
    }

    function inferMood(songs) {
      if (!songs.length) return "Quiet drive";
      const words = songs.map(song => `${song.track || ""} ${song.album || ""}`).join(" ").toLowerCase();
      const energetic = (words.match(/dance|fire|power|strong|tiger|feeling|rock|run|fast|party|alive/g) || []).length;
      const reflective = (words.match(/love|dream|slow|blue|night|moon|heart|rain|alone|quiet/g) || []).length;
      const artists = new Set(songs.map(song => song.artist).filter(Boolean)).size;
      if (energetic > reflective) return "High-energy mix";
      if (reflective > energetic) return "Chill & reflective";
      if (artists >= Math.max(4, songs.length * .7)) return "Discovery mode";
      return "Easygoing mix";
    }

    function renderSoundtrack() {
      const container = $("dashboardSoundtrack");
      if (!container) return;
      const drives = state.drives.slice(0, recentDriveCount);
      const songs = drives.flatMap(drive => drive.soundtrack || []);
      if (!songs.length) {
        container.innerHTML = `<div class="dashboard-widget-empty"><strong>No drive soundtrack yet</strong><span>Your next matched drive songs will appear here.</span></div>`;
        return;
      }
      const track = topGroup(songs, song => `${song.track || ""}\u0000${song.artist || ""}`);
      const artist = topGroup(songs, song => song.artist || "");
      const album = topGroup(songs, song => song.album || "");
      const uniqueArtists = new Set(songs.map(song => song.artist).filter(Boolean)).size;
      const uniqueTracks = new Set(songs.map(song => `${song.track || ""}\u0000${song.artist || ""}`).filter(Boolean)).size;
      const listeningMinutes = Math.max(1, Math.round(songs.reduce((total, song) => total + (Number(song.durationMs) || 180000), 0) / 60000));
      const recentSongs = songs.slice(0, 4);
      container.innerHTML = `
        <div class="dashboard-soundtrack-featured">
          ${artworkMarkup(track.item, "dashboard-soundtrack-artwork")}
          <div><span>Top song</span><strong>${escapeHtml(track.item.track || "Unknown track")}</strong><small>${escapeHtml(track.item.artist || "Unknown artist")} &middot; ${track.count} play${track.count === 1 ? "" : "s"}</small></div>
        </div>
        <div class="dashboard-soundtrack-facts">
          <div><span>Top artist</span><strong>${escapeHtml(artist?.item.artist || "--")}</strong></div>
          <div><span>Top album</span><strong>${escapeHtml(album?.item.album || "--")}</strong></div>
          <div><span>Drive mood</span><strong>${escapeHtml(inferMood(songs))}</strong></div>
        </div>
        <div class="dashboard-soundtrack-summary" aria-label="Recent drive music summary">
          <div><strong>${uniqueArtists}</strong><span>artists</span></div>
          <div><strong>${uniqueTracks}</strong><span>unique tracks</span></div>
          <div><strong>${listeningMinutes} min</strong><span>on the road</span></div>
        </div>
        <section class="dashboard-soundtrack-recent" aria-label="Recent songs from drives">
          <div class="dashboard-soundtrack-recent-heading"><span>Recent on the road</span><small>Latest matched plays</small></div>
          <div class="dashboard-soundtrack-recent-grid">
            ${recentSongs.map(song => `
              <div class="dashboard-soundtrack-recent-song">
                ${artworkMarkup(song, "dashboard-soundtrack-recent-artwork")}
                <div><strong>${escapeHtml(song.track || "Unknown track")}</strong><span>${escapeHtml(song.artist || "Unknown artist")}</span></div>
              </div>`).join("")}
          </div>
        </section>
        <div class="dashboard-soundtrack-caption">Based on ${songs.length} song${songs.length === 1 ? "" : "s"} across ${drives.length} recent drive${drives.length === 1 ? "" : "s"}</div>`;
    }

    function updateActionAvailability() {
      const disabled = !state.drives.length;
      document.querySelectorAll('[data-dashboard-action="share"], [data-dashboard-action="latest"]').forEach(button => { button.disabled = disabled; });
    }

    function render() {
      renderToday();
      renderSoundtrack();
      updateActionAvailability();
    }

    async function runAction(button) {
      const action = button.dataset.dashboardAction;
      if (action === "refresh") {
        button.classList.add("working");
        try { await actions.refresh(); } finally { button.classList.remove("working"); render(); }
      } else if (action === "share" && state.drives[0]) actions.openShareCard(state.drives[0]);
      else if (action === "search") actions.openSearch();
      else if (action === "latest" && state.drives[0]) actions.openDrive(state.drives[0]);
      else if (action === "recap") actions.openRecap();
    }

    function bind() {
      document.querySelectorAll("[data-dashboard-action]").forEach(button => {
        button.addEventListener("click", () => runAction(button));
      });
      render();
    }

    return Object.freeze({ bind, render });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.dashboardWidgets = Object.freeze({ create });
})();
