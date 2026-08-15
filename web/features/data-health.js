(function () {
  const $ = window.DriveOSDom.byId;
  const escapeHtml = window.DriveOSDom.escapeHtml;

  function create({ api }) {
    let loaded = false;
    let loading = false;

    const statusCopy = Object.freeze({
      healthy: "Healthy",
      degraded: "Needs attention",
      stale: "Late",
      failed: "Failed",
      unknown: "Waiting for data",
      attention: "Needs attention",
      "warming-up": "Warming up"
    });

    function formatTime(value) {
      if (!value) return "Not recorded yet";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Not recorded yet";
      return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }

    function signalMarkup(signal) {
      const error = signal.lastError ? `<p class="data-health-error">${escapeHtml(signal.lastError)}</p>` : "";
      const lag = signal.lagMinutes == null ? "Freshness pending" : `${Math.round(signal.lagMinutes)} min behind`;
      return `<article class="panel data-health-card status-${escapeHtml(signal.status)}">
        <div class="data-health-card-head"><div><div class="section-label">INTEGRATION</div><h3>${escapeHtml(signal.name)}</h3></div><span class="data-health-badge">${escapeHtml(statusCopy[signal.status] || signal.status)}</span></div>
        <dl><div><dt>Last success</dt><dd>${escapeHtml(formatTime(signal.lastSuccessAtUtc))}</dd></div><div><dt>Provider watermark</dt><dd>${escapeHtml(formatTime(signal.highWatermarkUtc))}</dd></div><div><dt>Freshness</dt><dd>${escapeHtml(lag)}</dd></div></dl>${error}
      </article>`;
    }

    function flag(label, enabled) {
      return `<div><span>${escapeHtml(label)}</span><strong class="${enabled ? "enabled" : "disabled"}">${enabled ? "Enabled" : "Disabled"}</strong></div>`;
    }

    function render(data) {
      const overall = $("dataHealthOverall");
      const overallLabel = statusCopy[data.overallStatus] || data.overallStatus;
      overall.className = `data-health-overall status-${data.overallStatus}`;
      overall.innerHTML = `<span class="data-health-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(overallLabel)}</strong><small>Checked ${escapeHtml(formatTime(data.generatedAtUtc))} from ${escapeHtml(data.repositoryProvider)}.</small></div>`;
      $("dataHealthIntegrations").innerHTML = (data.integrations || []).map(signalMarkup).join("");

      const projection = data.soundtrackProjection || {};
      $("dataHealthSoundtracks").innerHTML = [
        ["Recent drives", projection.recentDriveCount ?? 0],
        ["Materialized", projection.materializedCount ?? 0],
        ["Missing", projection.missingCount ?? 0],
        ["Pending", projection.pendingCount ?? 0]
      ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

      const rollout = data.rollout || {};
      $("dataHealthRollout").innerHTML = `<p><strong>${escapeHtml(data.repositoryProvider)}</strong> is the active repository.</p>${flag("Tessie worker writes", rollout.tessieWritesEnabled)}${flag("Database history reads", rollout.tessieReadsEnabled)}${flag("Read canary approved", rollout.readCanaryApproved)}`;
    }

    async function load() {
      if (loading) return;
      loading = true;
      const button = $("dataHealthRefresh");
      if (button) button.disabled = true;
      try {
        render(await api.get("/api/data-health"));
        loaded = true;
      } catch (error) {
        const overall = $("dataHealthOverall");
        overall.className = "data-health-overall status-failed";
        overall.innerHTML = `<span class="data-health-status-dot" aria-hidden="true"></span><div><strong>Health check unavailable</strong><small>${escapeHtml(error.message)}</small></div>`;
      } finally {
        loading = false;
        if (button) button.disabled = false;
      }
    }

    function bind() {
      $("dataHealthRefresh")?.addEventListener("click", load);
      document.addEventListener("journeydeck:viewchange", (event) => {
        if (event.detail?.view === "health" && !loaded) void load();
      });
    }

    return Object.freeze({ bind, load, render });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.dataHealth = Object.freeze({ create });
})();
