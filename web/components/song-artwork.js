(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function url(song) {
    if (song?.trackId) return `/api/spotify/artwork/${encodeURIComponent(song.trackId)}`;
    return song?.albumImage || "";
  }

  function markup(song, className = "song-list-artwork") {
    const source = url(song);
    const fallback = `<div class="${className} song-artwork-placeholder" aria-hidden="true">\u266B</div>`;
    if (!source) return fallback;
    return `
    <div class="${className} song-artwork-shell">
      <img class="song-artwork-image" src="${escapeHtml(source)}"
        alt="${escapeHtml(`${song.album || song.track || "Album"} artwork`)}" loading="lazy"
        onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
      <div class="song-artwork-placeholder" hidden aria-hidden="true">\u266B</div>
    </div>`;
  }

  window.DriveOSComponents = window.DriveOSComponents || {};
  window.DriveOSComponents.songArtwork = Object.freeze({ url, markup });
})();
