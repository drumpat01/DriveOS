(function () {
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const number = value => (Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const artworkUrl = song => window.DriveOSComponents?.songArtwork?.url(song) || "";
  const trackUri = song => song?.uri || song?.trackUri || (song?.trackId ? `spotify:track:${song.trackId}` : "");
  const formatTime = milliseconds => {
    const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };

  let recent = [];
  let stats = null;
  let drives = [];
  let player = null;
  let deviceId = "";
  let currentTrack = null;
  let currentToken = "";
  let playerReady = false;
  let playerPlaying = false;
  let shuffleEnabled = false;
  let sdkPromise = null;
  let progressTimer = 0;
  let positionMs = 0;
  let durationMs = 0;
  let positionCapturedAt = 0;
  const spotifyTokenKey = "journeydeck-spotify-player-token-v1";
  const spotifyPkceKey = "journeydeck-spotify-pkce-v1";
  const spotifyScopes = ["streaming", "user-read-email", "user-read-private", "user-read-playback-state", "user-modify-playback-state", "user-library-modify"];

  function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = String(value ?? "");
  }

  function uniqueSongs(items) {
    const seen = new Set();
    return items.filter(song => {
      const key = song.trackId || `${song.track}\0${song.artist}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function allJourneySongs() {
    return drives.flatMap(drive => Array.isArray(drive.soundtrack) ? drive.soundtrack : []);
  }

  function hasSoundtrack(drive) {
    return (Array.isArray(drive.soundtrack) && drive.soundtrack.length > 0) || Number(drive.songCount) > 0;
  }

  function dateValue(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfDay(value = new Date()) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function cityLabel(value) {
    const parts = String(value || "").split(",").map(part => part.trim()).filter(Boolean);
    if (!parts.length) return "On the road";
    if (parts.length >= 3) return parts[parts.length - 3];
    return parts[0].replace(/^\d+\s+/, "");
  }

  function renderHeroFallback() {
    if (currentTrack || !recent.length) return;
    const song = recent[0];
    const art = artworkUrl(song);
    const heroArtwork = byId("musicHeroArtwork");
    if (heroArtwork && art) { heroArtwork.src = art; heroArtwork.alt = `${song.album || song.track} artwork`; }
    setText("musicPlayerTrack", song.track || "Your latest song");
    setText("musicPlayerArtist", song.artist || "Spotify");
    setText("musicPlayerAlbum", song.album || "Latest archived play");
    setText("musicPlayerKicker", "Latest archived play");
  }

  function renderSoundtrack() {
    const container = byId("topTracks");
    if (!container) return;
    const today = startOfDay();
    let songs = recent.filter(song => {
      const played = dateValue(song.playedAt);
      return played && startOfDay(played).getTime() === today.getTime();
    });
    if (!songs.length) songs = recent;
    songs = uniqueSongs(songs).slice(0, 6);
    setText("musicTodayCount", songs.length ? `${songs.length} recent selections` : "Waiting for Spotify");
    container.innerHTML = songs.length ? songs.map(song => {
      const art = artworkUrl(song);
      const uri = trackUri(song);
      return `<button class="music-album" type="button" data-music-uri="${escapeHtml(uri)}" data-music-url="${escapeHtml(song.spotifyUrl || "")}" aria-label="Play ${escapeHtml(song.track)} by ${escapeHtml(song.artist)}">
        <span class="music-album-art">${art ? `<img src="${escapeHtml(art)}" alt="${escapeHtml(song.album || song.track)} artwork" loading="lazy">` : `<i aria-hidden="true">&#x266B;</i>`}<b aria-hidden="true">&#x25B6;</b></span>
        <strong>${escapeHtml(song.track || "Untitled")}</strong><small>${escapeHtml(song.artist || "Unknown artist")}</small>
      </button>`;
    }).join("") : `<div class="music-empty">Play something on Spotify and it will appear here.</div>`;
  }

  function renderArtists() {
    const container = byId("topArtists");
    if (!container) return;
    const artistArt = new Map();
    [...recent, ...(stats?.topTracks || [])].forEach(song => {
      const art = artworkUrl(song);
      if (song.artist && art && !artistArt.has(song.artist.toLowerCase())) artistArt.set(song.artist.toLowerCase(), art);
    });
    const artists = (stats?.topArtists || []).slice(0, 5);
    container.innerHTML = artists.length ? artists.map((artist, index) => {
      const art = artist.imageUrl || artistArt.get(String(artist.artist || "").toLowerCase());
      return `<div class="music-artist-row"><span>${String(index + 1).padStart(2, "0")}</span><div class="music-artist-avatar">${art ? `<img src="${escapeHtml(art)}" alt="" loading="lazy">` : escapeHtml(String(artist.artist || "?").slice(0, 1))}</div><strong>${escapeHtml(artist.artist || "Unknown artist")}</strong><small>${number(artist.plays)} plays</small></div>`;
    }).join("") : `<div class="music-empty">Top artists will build from your listening archive.</div>`;
  }

  function renderMetrics() {
    const soundtrackDrives = drives.filter(hasSoundtrack);
    const songs = allJourneySongs();
    const miles = soundtrackDrives.reduce((sum, drive) => sum + (Number(drive.miles) || 0), 0);
    const duration = songs.reduce((sum, song) => sum + (Number(song.durationMs) || 0), 0);
    setText("musicMilesWithMusic", number(miles));
    setText("musicListeningHours", number(duration / 3_600_000));
    setText("musicSongsOnRoad", number(songs.length || soundtrackDrives.reduce((sum, drive) => sum + (Number(drive.songCount) || 0), 0)));

    const daily = stats?.daily || [];
    let streak = 0;
    for (let index = daily.length - 1; index >= 0; index -= 1) {
      if ((Number(daily[index].count) || 0) <= 0) break;
      streak += 1;
    }
    setText("musicCurrentStreak", number(streak));
  }

  function renderMileage() {
    const now = startOfDay();
    const thisStart = new Date(now); thisStart.setDate(now.getDate() - 6);
    const previousStart = new Date(thisStart); previousStart.setDate(thisStart.getDate() - 7);
    const mileage = (from, to) => drives.filter(hasSoundtrack).reduce((sum, drive) => {
      const started = dateValue(drive.startedAt);
      return started && started >= from && started < to ? sum + (Number(drive.miles) || 0) : sum;
    }, 0);
    const current = mileage(thisStart, new Date(now.getTime() + 86_400_000));
    const previous = mileage(previousStart, thisStart);
    const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
    setText("musicTourMileage", number(current));
    const changeElement = byId("musicTourChange");
    if (changeElement) {
      changeElement.textContent = change == null ? "First week of matched journey music" : `${change >= 0 ? "\u2191" : "\u2193"} ${Math.abs(change)}% vs last week`;
      changeElement.classList.toggle("down", change != null && change < 0);
    }
  }

  function renderMood() {
    const buckets = [0, 0, 0, 0];
    const labels = ["Morning", "Midday", "Evening", "Late night"];
    const songs = allJourneySongs();
    (songs.length ? songs : recent).forEach(song => {
      const played = dateValue(song.playedAt);
      if (!played) return;
      const hour = played.getHours();
      buckets[hour < 10 ? 0 : hour < 16 ? 1 : hour < 22 ? 2 : 3] += 1;
    });
    const total = Math.max(1, buckets.reduce((sum, value) => sum + value, 0));
    const percentages = buckets.map(value => Math.round((value / total) * 100));
    const bar = byId("musicMoodBar");
    if (bar) [...bar.children].forEach((segment, index) => { segment.style.width = `${Math.max(percentages[index], buckets[index] ? 4 : 0)}%`; });
    const legend = byId("musicMoodLegend");
    if (legend) legend.innerHTML = labels.map((label, index) => `<div><strong>${percentages[index]}%</strong><span>${label}</span></div>`).join("");
  }

  function renderCities() {
    const groups = new Map();
    drives.filter(hasSoundtrack).forEach(drive => {
      const city = cityLabel(drive.endingLocation || drive.startingLocation);
      const count = Array.isArray(drive.soundtrack) ? drive.soundtrack.length : Number(drive.songCount) || 0;
      groups.set(city, (groups.get(city) || 0) + count);
    });
    const rows = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(1, ...rows.map(row => row[1]));
    const container = byId("musicCities");
    if (container) container.innerHTML = rows.length ? rows.map(([city, count]) => `<div><span>${escapeHtml(city)}</span><i><b style="width:${Math.round((count / max) * 100)}%"></b></i><strong>${number(count)}</strong></div>`).join("") : `<div class="music-empty">Journey locations with music will appear here.</div>`;
  }

  function lastSevenDays() {
    return (stats?.daily || []).slice(-7).map(day => ({ ...day, count: Number(day.count) || 0 }));
  }

  function renderIntensity() {
    const daily = lastSevenDays();
    const container = byId("musicIntensityChart");
    if (!container || !daily.length) return;
    const max = Math.max(1, ...daily.map(day => day.count));
    const points = daily.map((day, index) => ({ x: 12 + (index * 46), y: 112 - ((day.count / max) * 88), ...day }));
    const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
    const area = `${path} L${points[points.length - 1].x},116 L${points[0].x},116 Z`;
    container.innerHTML = `<svg viewBox="0 0 300 145" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="musicAreaGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a4d" stop-opacity=".65"/><stop offset="1" stop-color="#ff315e" stop-opacity=".03"/></linearGradient></defs><path class="music-intensity-area" d="${area}"/><path class="music-intensity-line" d="${path}"/>${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3"/>`).join("")}</svg><div class="music-intensity-labels">${daily.map(day => `<span>${escapeHtml(day.label)}</span>`).join("")}</div>`;
    container.setAttribute("aria-label", daily.map(day => `${day.label}: ${day.count} plays`).join(", "));
  }

  function renderWeek() {
    const daily = lastSevenDays();
    const max = Math.max(1, ...daily.map(day => day.count));
    const container = byId("musicWeekBars");
    if (container) container.innerHTML = daily.map(day => `<div title="${day.count} plays"><i style="height:${Math.max(day.count ? 8 : 2, Math.round((day.count / max) * 90))}%"></i><span>${escapeHtml(String(day.label || "").slice(0, 1))}</span></div>`).join("");
    const current = daily.reduce((sum, day) => sum + day.count, 0);
    const previous = (stats?.daily || []).slice(-14, -7).reduce((sum, day) => sum + (Number(day.count) || 0), 0);
    const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
    setText("musicWeekTotal", number(current));
    setText("musicWeekChange", change == null ? "New" : `${change >= 0 ? "+" : ""}${change}%`);
    byId("musicWeekChange")?.classList.toggle("down", change != null && change < 0);
  }

  function render(nextStats, nextDrives, nextRecent) {
    stats = nextStats || stats || {};
    drives = Array.isArray(nextDrives) ? nextDrives : drives;
    recent = Array.isArray(nextRecent) ? nextRecent : recent;
    renderHeroFallback();
    renderSoundtrack();
    renderArtists();
    renderMetrics();
    renderMileage();
    renderMood();
    renderCities();
    renderIntensity();
    renderWeek();
  }

  function storedSpotifyToken() {
    try { return JSON.parse(localStorage.getItem(spotifyTokenKey) || "null"); }
    catch { return null; }
  }

  function saveSpotifyToken(data, previousRefreshToken = "") {
    const token = {
      accessToken: String(data.access_token || ""),
      refreshToken: String(data.refresh_token || previousRefreshToken || ""),
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      scope: String(data.scope || spotifyScopes.join(" "))
    };
    localStorage.setItem(spotifyTokenKey, JSON.stringify(token));
    return token;
  }

  async function refreshSpotifyToken(token) {
    if (!token?.refreshToken || !token?.clientId) throw new Error("Spotify playback needs to be enabled again.");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: token.clientId, grant_type: "refresh_token", refresh_token: token.refreshToken })
    });
    if (!response.ok) throw new Error("Spotify authorization expired — enable playback again.");
    const refreshed = saveSpotifyToken(await response.json(), token.refreshToken);
    refreshed.clientId = token.clientId;
    localStorage.setItem(spotifyTokenKey, JSON.stringify(refreshed));
    return refreshed;
  }

  async function session() {
    let token = storedSpotifyToken();
    if (token) {
      if (Date.now() >= Number(token.expiresAt || 0) - 120000) token = await refreshSpotifyToken(token);
      currentToken = token.accessToken || "";
      return { accessToken: currentToken, playbackReady: Boolean(currentToken), missingScopes: [] };
    }
    const data = await window.DriveOSApi.get("/api/spotify/player/session");
    currentToken = data.accessToken || "";
    return data;
  }

  function base64Url(bytes) {
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }

  async function beginBrowserAuthorization(config) {
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
    const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
    const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    sessionStorage.setItem(spotifyPkceKey, JSON.stringify({ verifier, state, clientId: config.clientId, redirectUri: config.redirectUri, createdAt: Date.now() }));
    const parameters = new URLSearchParams({ client_id: config.clientId, response_type: "code", redirect_uri: config.redirectUri, scope: spotifyScopes.join(" "), code_challenge_method: "S256", code_challenge: challenge, state });
    location.assign(`https://accounts.spotify.com/authorize?${parameters}`);
  }

  async function finishBrowserAuthorization() {
    if (location.pathname !== "/spotify-callback") return false;
    const query = new URLSearchParams(location.search);
    const transaction = JSON.parse(sessionStorage.getItem(spotifyPkceKey) || "null");
    if (query.get("error")) throw new Error(`Spotify authorization failed: ${query.get("error")}`);
    if (!transaction || !query.get("code") || query.get("state") !== transaction.state || Date.now() - transaction.createdAt > 10 * 60 * 1000) throw new Error("Spotify authorization could not be verified. Please try again.");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: transaction.clientId, grant_type: "authorization_code", code: query.get("code"), redirect_uri: transaction.redirectUri, code_verifier: transaction.verifier })
    });
    if (!response.ok) throw new Error("Spotify did not accept the playback authorization.");
    const token = saveSpotifyToken(await response.json());
    token.clientId = transaction.clientId;
    localStorage.setItem(spotifyTokenKey, JSON.stringify(token));
    sessionStorage.removeItem(spotifyPkceKey);
    history.replaceState({}, "", "/#music");
    return true;
  }

  function loadSdk() {
    if (window.Spotify) return Promise.resolve(window.Spotify);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => reject(new Error("Spotify player could not be loaded."));
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  async function spotifyRequest(path, options = {}) {
    if (!currentToken) await session();
    let response = await fetch(`https://api.spotify.com/v1${path}`, { ...options, headers: { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    if (response.status === 401) {
      currentToken = "";
      await session();
      response = await fetch(`https://api.spotify.com/v1${path}`, { ...options, headers: { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    }
    if (!response.ok && response.status !== 204) throw new Error(`Spotify returned ${response.status}.`);
    return response;
  }

  function updateProgress() {
    if (playerPlaying && positionCapturedAt) positionMs = Math.min(durationMs, positionMs + (Date.now() - positionCapturedAt));
    positionCapturedAt = Date.now();
    const ratio = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
    const bar = byId("musicPlayerProgress");
    if (bar) bar.style.width = `${ratio * 100}%`;
    setText("musicPlayerElapsed", formatTime(positionMs));
    setText("musicPlayerDuration", formatTime(durationMs));
  }

  function updatePlayerState(playbackState) {
    if (!playbackState) return;
    const track = playbackState.track_window?.current_track;
    currentTrack = track || currentTrack;
    playerPlaying = !playbackState.paused;
    positionMs = playbackState.position || 0;
    durationMs = playbackState.duration || track?.duration_ms || 0;
    positionCapturedAt = Date.now();
    setText("musicPlayerToggleIcon", playerPlaying ? "\u275A\u275A" : "\u25B6");
    const toggle = document.querySelector('[data-music-player="toggle"]');
    if (toggle) toggle.setAttribute("aria-label", playerPlaying ? "Pause" : "Play");
    if (track) {
      const artists = (track.artists || []).map(artist => artist.name).join(", ");
      setText("musicPlayerTrack", track.name);
      setText("musicPlayerArtist", artists);
      setText("musicPlayerAlbum", track.album?.name || "Spotify");
      setText("musicPlayerKicker", playerPlaying ? "Now playing" : "Ready to play");
      const art = track.album?.images?.[0]?.url;
      const heroArtwork = byId("musicHeroArtwork");
      if (heroArtwork && art) { heroArtwork.src = art; heroArtwork.alt = `${track.album?.name || track.name} artwork`; }
    }
    updateProgress();
  }

  async function initializePlayer() {
    if (player || playerReady) return;
    playerReady = true;
    try {
      const spotifySession = await session();
      if (!spotifySession.playbackReady) {
        setText("musicPlayerStatus", "One-time Spotify permission update needed");
        const reconnect = byId("musicPlayerReconnect");
        if (reconnect) reconnect.hidden = false;
        playerReady = false;
        return;
      }
      const Spotify = await loadSdk();
      player = new Spotify.Player({
        name: "JourneyDeck Web Player",
        getOAuthToken: callback => { session().then(data => callback(data.accessToken)).catch(() => callback("")); },
        volume: 0.65
      });
      player.addListener("ready", async ({ device_id: readyDeviceId }) => {
        deviceId = readyDeviceId;
        setText("musicPlayerStatus", "JourneyDeck Web Player ready");
        try { await spotifyRequest("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [deviceId], play: false }) }); }
        catch { setText("musicPlayerStatus", "Select JourneyDeck in Spotify Connect"); }
      });
      player.addListener("not_ready", () => { setText("musicPlayerStatus", "Spotify player is offline"); });
      player.addListener("player_state_changed", updatePlayerState);
      player.addListener("account_error", () => { setText("musicPlayerStatus", "Spotify Premium is required for web playback"); });
      player.addListener("authentication_error", () => { setText("musicPlayerStatus", "Spotify authorization expired — reconnect"); byId("musicPlayerReconnect").hidden = false; });
      player.addListener("initialization_error", ({ message }) => { setText("musicPlayerStatus", message || "Spotify player could not start"); });
      await player.connect();
      window.clearInterval(progressTimer);
      progressTimer = window.setInterval(updateProgress, 1000);
    } catch (error) {
      setText("musicPlayerStatus", error.message || "Spotify playback is unavailable");
      const reconnect = byId("musicPlayerReconnect");
      if (reconnect) reconnect.hidden = false;
      playerReady = false;
    }
  }

  async function playUri(uri, fallbackUrl) {
    if (!uri) { if (fallbackUrl) window.open(fallbackUrl, "_blank", "noopener,noreferrer"); return; }
    await initializePlayer();
    if (!deviceId) { setText("musicPlayerStatus", "Waiting for JourneyDeck Web Player\u2026"); return; }
    try {
      await spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: "PUT", body: JSON.stringify({ uris: [uri] }) });
    } catch (error) { setText("musicPlayerStatus", error.message); }
  }

  async function reconnect() {
    const button = byId("musicPlayerReconnect");
    if (button) { button.disabled = true; button.textContent = "Opening Spotify\u2026"; }
    try {
      const authorization = await window.DriveOSApi.post("/api/spotify/player/connect", {});
      if (authorization.mode === "pkce") {
        await beginBrowserAuthorization(authorization);
        return;
      }
      setText("musicPlayerStatus", "Approve Spotify playback in the opened browser");
      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const status = await window.DriveOSApi.get("/api/spotify/player/auth-status");
        if (!status.playbackReady) continue;
        if (button) button.hidden = true;
        currentToken = "";
        playerReady = false;
        await initializePlayer();
        return;
      }
      throw new Error("Spotify approval window expired.");
    } catch (error) {
      setText("musicPlayerStatus", error.message || "Spotify authorization could not start");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Enable playback"; }
    }
  }

  function bind() {
    byId("musicPlayerReconnect")?.addEventListener("click", reconnect);
    byId("topTracks")?.addEventListener("click", event => {
      const button = event.target.closest("[data-music-uri]");
      if (button) void playUri(button.dataset.musicUri, button.dataset.musicUrl);
    });
    document.querySelectorAll("[data-music-player]").forEach(button => button.addEventListener("click", async () => {
      const action = button.dataset.musicPlayer;
      try {
        await initializePlayer();
        if (action === "toggle") await player?.togglePlay();
        if (action === "previous") await player?.previousTrack();
        if (action === "next") await player?.nextTrack();
        if (action === "shuffle") { shuffleEnabled = !shuffleEnabled; await spotifyRequest(`/me/player/shuffle?state=${shuffleEnabled}&device_id=${encodeURIComponent(deviceId)}`, { method: "PUT" }); button.classList.toggle("active", shuffleEnabled); }
        if (action === "favorite" && currentTrack?.id) { await spotifyRequest(`/me/tracks?ids=${encodeURIComponent(currentTrack.id)}`, { method: "PUT" }); button.classList.add("active"); setText("musicPlayerStatus", "Saved to your Liked Songs"); }
      } catch (error) { setText("musicPlayerStatus", error.message || "Spotify control unavailable"); }
    }));
    document.addEventListener("journeydeck:viewchange", event => { if (event.detail?.view === "music") void initializePlayer(); });
    if (location.pathname === "/spotify-callback") {
      setText("musicPlayerStatus", "Finishing Spotify authorization…");
      void finishBrowserAuthorization().then(() => initializePlayer()).catch(error => {
        history.replaceState({}, "", "/#music");
        setText("musicPlayerStatus", error.message || "Spotify authorization failed");
        const reconnect = byId("musicPlayerReconnect");
        if (reconnect) reconnect.hidden = false;
      });
    } else if (location.hash === "#music") setTimeout(() => { void initializePlayer(); }, 0);
  }

  bind();
  window.DriveOSMusicDashboard = Object.freeze({ render, setRecent(items) { recent = Array.isArray(items) ? items : []; renderHeroFallback(); renderSoundtrack(); } });
})();
