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
      ready: "Ready",
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
      const displayName = String(signal.name || '').replace(/Tessie drives/gi, 'Tessie journeys');
      return `<article class="panel data-health-card status-${escapeHtml(signal.status)}">
        <div class="data-health-card-head"><div><div class="section-label">INTEGRATION</div><h3>${escapeHtml(displayName)}</h3></div><span class="data-health-badge">${escapeHtml(statusCopy[signal.status] || signal.status)}</span></div>
        <dl><div><dt>Last success</dt><dd>${escapeHtml(formatTime(signal.lastSuccessAtUtc))}</dd></div><div><dt>Provider watermark</dt><dd>${escapeHtml(formatTime(signal.highWatermarkUtc))}</dd></div><div><dt>Freshness</dt><dd>${escapeHtml(lag)}</dd></div></dl>${error}
      </article>`;
    }

    function flag(label, enabled) {
      return `<div><span>${escapeHtml(label)}</span><strong class="${enabled ? "enabled" : "disabled"}">${enabled ? "Enabled" : "Disabled"}</strong></div>`;
    }

    function renderAlertNavigation(alerts, unavailable = false) {
      const count = alerts.length;
      [$('dataHealthNavAlertCount'), $('mobileDataHealthAlertCount')].filter(Boolean).forEach((badge) => {
        badge.hidden = !unavailable && count === 0;
        badge.textContent = unavailable ? '!' : String(count);
        badge.setAttribute('aria-label', unavailable ? 'Data Health unavailable' : `${count} active data health alert${count === 1 ? '' : 's'}`);
      });
      [$('dataHealthNav'), $('mobileDataHealthNav')].filter(Boolean).forEach((button) => button.classList.toggle('has-data-health-alerts', unavailable || count > 0));
    }

    function renderAlerts(alerts) {
      const target = $('dataHealthAlerts');
      if (!target) return;
      if (!alerts.length) {
        target.innerHTML = '<p class="data-health-no-alerts"><span aria-hidden="true">&#10003;</span> No active alerts. Syncs, soundtracks, and durable database gates look good.</p>';
        return;
      }
      target.innerHTML = alerts.map((alert) => `<section class="data-health-alert severity-${escapeHtml(alert.severity || 'warning')}"><span class="data-health-alert-icon" aria-hidden="true">${alert.severity === 'critical' ? '!' : '&#9888;'}</span><div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.message)}</p></div></section>`).join('');
    }

    function render(data) {
      const audit = data.integrityAudit;
      const alerts = data.alerts || [];
      const integrations = data.integrations || [];
      const overallStatus = data.overallStatus;
      const overall = $("dataHealthOverall");
      const overallLabel = statusCopy[overallStatus] || overallStatus;
      overall.className = `data-health-overall status-${overallStatus}`;
      overall.innerHTML = `<span class="data-health-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(overallLabel)}</strong><small>Checked ${escapeHtml(formatTime(data.generatedAtUtc))} from ${escapeHtml(data.repositoryProvider)}.</small></div>`;
      renderAlerts(alerts);
      renderAlertNavigation(alerts);
      $("dataHealthIntegrations").innerHTML = integrations.map(signalMarkup).join("");

      const projection = data.soundtrackProjection || {};
      $("dataHealthSoundtracks").innerHTML = [
        ["Recent journeys", projection.recentDriveCount ?? 0],
        ["Materialized", projection.materializedCount ?? 0],
        ["Missing", projection.missingCount ?? 0],
        ["Pending", projection.pendingCount ?? 0]
      ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

      const rollout = data.rollout || {};
      $("dataHealthRollout").innerHTML = `<p><strong>${escapeHtml(data.repositoryProvider)}</strong> is the active repository.</p>${flag("Tessie worker writes", rollout.tessieWritesEnabled)}${flag("Database history reads", rollout.tessieReadsEnabled)}${flag("Read canary approved", rollout.readCanaryApproved)}`;

      const auditReport = audit?.report || {};
      const auditDrives = auditReport.resources?.drives || {};
      const auditCharges = auditReport.resources?.charges || {};
      const cursorCheck = (auditReport.checks || []).find(check => check.name === 'cursor-readiness');
      const persistedCursors = auditReport.cursors || [];
      const cursorPassed = cursorCheck?.passed === true || (persistedCursors.length > 0 && persistedCursors.every(cursor => cursor.passed === true));
      const auditTarget = $("dataHealthIntegrityAudit");
      if (auditTarget) {
        auditTarget.innerHTML = [
          ["Last result", audit ? (statusCopy[audit.status] || audit.status) : "Waiting"],
          ["Completed", audit ? formatTime(audit.completedAtUtc) : "Not yet"],
          ["Journey parity", auditDrives.passed === true ? "Passed" : audit ? "Failed" : "Pending"],
          ["Charge parity", auditCharges.passed === true ? "Passed" : audit ? "Failed" : "Pending"],
          ["Cursor policy", !audit ? "Pending" : cursorPassed ? "Passed" : "Failed"]
        ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
      }
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
        renderAlerts([{ severity: 'critical', title: 'Data Health check unavailable', message: error.message }]);
        renderAlertNavigation([], true);
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

    return Object.freeze({ bind, load, render, renderAlerts });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.dataHealth = Object.freeze({ create });
})();
