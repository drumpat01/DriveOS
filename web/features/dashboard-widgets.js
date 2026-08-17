(function () {
  const $ = window.DriveOSDom.byId;
  const escapeHtml = window.DriveOSDom.escapeHtml;
  const setText = window.DriveOSDom.setText;

  function create({ state, artworkMarkup, api, actions }) {
    const recentDriveCount = 10;
    const routeThumbnailCache = new Map();

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
        ? `${summary.drives.length} completed journe${summary.drives.length === 1 ? "y" : "ys"} today`
        : "No trips recorded yet today");
      renderHourlyChart(summary.drives);
    }

    function renderHourlyChart(drives) {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const hourlyMiles = Array(24).fill(0);

      drives.forEach(drive => {
        const start = new Date(drive.startedAt);
        const end = new Date(drive.endedAt);
        const miles = Math.max(0, Number(drive.miles) || 0);
        const duration = end.getTime() - start.getTime();
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || duration <= 0) {
          if (Number.isFinite(start.getTime())) hourlyMiles[start.getHours()] += miles;
          return;
        }
        for (let hour = 0; hour < 24; hour += 1) {
          const hourStart = new Date(dayStart.getTime() + hour * 3_600_000);
          const hourEnd = new Date(hourStart.getTime() + 3_600_000);
          const overlap = Math.max(0, Math.min(end.getTime(), hourEnd.getTime()) - Math.max(start.getTime(), hourStart.getTime()));
          if (overlap) hourlyMiles[hour] += miles * overlap / duration;
        }
      });

      const currentHour = now.getHours();
      const completedHours = hourlyMiles.slice(0, currentHour + 1);
      const maxHourly = Math.max(1, ...completedHours);
      const totalMiles = completedHours.reduce((sum, value) => sum + value, 0);
      const bars = document.querySelector(".ref-chart-bars");
      if (bars) {
        bars.innerHTML = hourlyMiles.map((miles, hour) => {
          if (hour > currentHour) return `<i class="is-future" data-hour="${hour}"></i>`;
          const height = miles > 0 ? Math.max(8, miles / maxHourly * 100) : 0;
          return `<i class="${miles > 0 ? "has-data" : ""}" data-hour="${hour}" style="--activity:${height}%" title="${hour}:00 · ${miles.toFixed(1)} miles"></i>`;
        }).join("");
      }

      let cumulative = 0;
      const points = completedHours.map((miles, hour) => {
        cumulative += miles;
        const x = 2 + hour / 23 * 401;
        const y = totalMiles > 0 ? 62 - cumulative / totalMiles * 49 : 62;
        return { x, y };
      });
      const line = document.querySelector("[data-ref-hourly-line]");
      if (line) line.setAttribute("d", points.length ? points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") : "");
      const pointLayer = document.querySelector("[data-ref-hourly-points]");
      if (pointLayer) {
        const visible = points.filter((_, hour) => hour === 0 || hour === currentHour || hour % 6 === 0);
        pointLayer.innerHTML = visible.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2"/>`).join("");
      }
    }

    function normalizedRoutePath(points) {
      const route = (points || []).filter(point => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)));
      if (route.length < 2) return "";
      const step = Math.max(1, Math.ceil(route.length / 36));
      const sampled = route.filter((_, index) => index % step === 0);
      if (sampled[sampled.length - 1] !== route[route.length - 1]) sampled.push(route[route.length - 1]);
      const longitudes = sampled.map(point => Number(point.longitude));
      const latitudes = sampled.map(point => Number(point.latitude));
      const minX = Math.min(...longitudes), maxX = Math.max(...longitudes);
      const minY = Math.min(...latitudes), maxY = Math.max(...latitudes);
      const width = Math.max(.000001, maxX - minX), height = Math.max(.000001, maxY - minY);
      return sampled.map((point, index) => {
        const x = 7 + (Number(point.longitude) - minX) / width * 60;
        const y = 47 - (Number(point.latitude) - minY) / height * 40;
        return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ");
    }

    async function renderJourneyRouteThumbnails() {
      if (!api?.post) return;
      const drives = state.drives.slice(0, 2);
      await Promise.allSettled(drives.map(async (drive, index) => {
        if (!routeThumbnailCache.has(drive.id)) {
          routeThumbnailCache.set(drive.id, api.post("/api/drive/map", { driveId: drive.id }).catch(() => null));
        }
        const map = await routeThumbnailCache.get(drive.id);
        const path = normalizedRoutePath(map?.routePoints);
        const svg = document.querySelector(`[data-reference-drive="${index}"] svg`);
        if (!svg) return;
        svg.classList.remove("route-loading", "route-unavailable");
        if (!path) {
          svg.classList.add("route-unavailable");
          svg.innerHTML = '<path class="thumb-route-empty" d="M10 42 64 12"/>';
          return;
        }
        svg.classList.add("is-live-route");
        svg.innerHTML = `<path class="thumb-route-halo" d="${path}"/><path class="thumb-route" d="${path}"/><circle class="thumb-start" cx="${path.match(/^M([\d.]+)/)?.[1] || 7}" cy="${path.match(/^M[\d.]+ ([\d.]+)/)?.[1] || 47}" r="2.5"/><circle class="thumb-end" cx="${path.match(/L([\d.]+) [\d.]+$/)?.[1] || 67}" cy="${path.match(/L[\d.]+ ([\d.]+)$/)?.[1] || 7}" r="3"/>`;
      }));
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
      if (!songs.length) return "Quiet journey";
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
      const songs = drives.flatMap(drive => (drive.soundtrack || []).filter(Boolean));
      if (!songs.length) {
        container.innerHTML = `<div class="dashboard-widget-empty"><strong>No journey soundtrack yet</strong><span>Your next matched journey songs will appear here.</span></div>`;
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
          <div><span>Journey mood</span><strong>${escapeHtml(inferMood(songs))}</strong></div>
        </div>
        <div class="dashboard-soundtrack-summary" aria-label="Recent journey music summary">
          <div><strong>${uniqueArtists}</strong><span>artists</span></div>
          <div><strong>${uniqueTracks}</strong><span>unique tracks</span></div>
          <div><strong>${listeningMinutes} min</strong><span>on the road</span></div>
        </div>
        <section class="dashboard-soundtrack-recent" aria-label="Recent songs from journeys">
          <div class="dashboard-soundtrack-recent-heading"><span>Recent on the road</span><small>Latest matched plays</small></div>
          <div class="dashboard-soundtrack-recent-grid">
            ${recentSongs.map(song => `
              <div class="dashboard-soundtrack-recent-song">
                ${artworkMarkup(song, "dashboard-soundtrack-recent-artwork")}
                <div><strong>${escapeHtml(song.track || "Unknown track")}</strong><span>${escapeHtml(song.artist || "Unknown artist")}</span></div>
              </div>`).join("")}
          </div>
        </section>
        <div class="dashboard-soundtrack-caption">Based on ${songs.length} song${songs.length === 1 ? "" : "s"} across ${drives.length} recent journe${drives.length === 1 ? "y" : "ys"}</div>`;
    }

    function updateActionAvailability() {
      const disabled = !state.drives.length;
      document.querySelectorAll('[data-dashboard-action="share"], [data-dashboard-action="latest"]').forEach(button => { button.disabled = disabled; });
    }

    function newestDrive() {
      return [...state.drives].sort((left, right) => {
        const leftTime = new Date(left.endedAt || left.startedAt || 0).getTime();
        const rightTime = new Date(right.endedAt || right.startedAt || 0).getTime();
        return rightTime - leftTime;
      })[0] || null;
    }

    function setReferenceText(selector, value) {
      document.querySelectorAll(selector).forEach(node => { node.textContent = value; });
    }

    function renderDesktopOverview() {
      const latest = newestDrive();
      if (latest) {
        setReferenceText("[data-ref-latest-origin]", latest.startingLocation || "Journey start");
        setReferenceText("[data-ref-latest-destination]", latest.endingLocation || "Journey end");
        setReferenceText("[data-ref-latest-meta]", [
          latest.shortDateLabel,
          Number.isFinite(Number(latest.miles)) ? `${Number(latest.miles).toFixed(1)} mi` : null,
          Number.isFinite(Number(latest.durationMinutes)) ? formatMinutes(latest.durationMinutes) : null
        ].filter(Boolean).join(" · "));
      }

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const week = state.drives.filter(drive => new Date(drive.startedAt || drive.endedAt || 0) >= weekStart);
      const miles = week.reduce((total, drive) => total + (Number(drive.miles) || 0), 0);
      const minutes = week.reduce((total, drive) => total + (Number(drive.durationMinutes) || 0), 0);
      const songs = week.reduce((total, drive) => total + (Number(drive.songCount) || (drive.soundtrack || []).length), 0);
      setReferenceText("[data-ref-week-miles]", miles.toFixed(1).replace(/\.0$/, ""));
      setReferenceText("[data-ref-week-drives]", week.length);
      setReferenceText("[data-ref-week-time]", formatMinutes(minutes));
      setReferenceText("[data-ref-week-songs]", songs);
    }

    function render() {
      renderToday();
      renderSoundtrack();
      updateActionAvailability();
      renderDesktopOverview();
      void renderJourneyRouteThumbnails();
    }

    async function runAction(button) {
      const action = button.dataset.dashboardAction;
      if (action === "refresh") {
        button.classList.add("working");
        try { await actions.refresh(); } finally { button.classList.remove("working"); render(); }
      } else if (action === "share" && newestDrive()) actions.openShareCard(newestDrive());
      else if (action === "search") actions.openSearch();
      else if (action === "latest" && newestDrive()) actions.openDrive(newestDrive());
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
