(function () {
  const byId = id => document.getElementById(id);
  const escapeHtml = value => window.DriveOSDom?.escapeHtml?.(value) ?? String(value ?? "");
  const number = (value, digits = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
      : "--";
  };
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const dayMs = 86_400_000;
  let latestSummary = null;
  let latestDrives = [];
  let currentRange = "daily";
  let controlsBound = false;
  let activeOptions = {};
  let activeLongestDrive = null;

  function driveDate(drive) {
    const date = new Date(drive?.startedAt || drive?.started_at || "");
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function within(drives, start, end) {
    return drives.filter(drive => {
      const date = driveDate(drive);
      return date && date >= start && date < end;
    });
  }

  function metricsFor(drives) {
    let miles = 0;
    let energy = 0;
    let battery = 0;
    let songs = 0;
    let minutes = 0;
    let autopilot = 0;
    let autopilotEligibleMiles = 0;
    let autopilotKnown = false;
    let efficiencyTotal = 0;
    let efficiencyCount = 0;
    for (const drive of drives) {
      const driveMiles = Number(drive.miles);
      const driveEnergy = Number(drive.energyKWh);
      const driveBattery = Number(drive.batteryUsed);
      const driveMinutes = Number(drive.durationMinutes);
      const driveEfficiency = Number(drive.efficiencyWhMi);
      const driveAutopilot = Number(drive.autopilotMiles);
      if (Number.isFinite(driveMiles)) miles += driveMiles;
      if (Number.isFinite(driveEnergy)) energy += driveEnergy;
      if (Number.isFinite(driveBattery)) battery += driveBattery;
      if (Number.isFinite(driveMinutes)) minutes += driveMinutes;
      if (Number.isFinite(driveEfficiency) && driveEfficiency > 0) {
        efficiencyTotal += driveEfficiency;
        efficiencyCount += 1;
      }
      if (drive.autopilotMiles != null && Number.isFinite(driveAutopilot) && driveAutopilot >= 0) {
        autopilot += driveAutopilot;
        autopilotKnown = true;
        if (Number.isFinite(driveMiles) && driveMiles > 0) autopilotEligibleMiles += driveMiles;
      }
      songs += Number(drive.songCount) || (Array.isArray(drive.soundtrack) ? drive.soundtrack.length : 0);
    }
    const efficiency = miles > 0 && energy > 0
      ? Math.round((energy * 1000) / miles)
      : efficiencyCount ? Math.round(efficiencyTotal / efficiencyCount) : null;
    return {
      journeys: drives.length,
      miles,
      energy,
      battery,
      songs,
      minutes,
      efficiency,
      autopilot: autopilotKnown ? autopilot : null,
      autopilotEligibleMiles
    };
  }

  function summaryMetrics(summary, fallback) {
    if (!summary) return fallback;
    return {
      ...fallback,
      journeys: Number(summary.driveCount) || 0,
      miles: Number(summary.totalMiles) || 0,
      energy: Number(summary.totalEnergyKWh) || 0,
      battery: Number(summary.totalBatteryUsed) || 0,
      songs: Number(summary.soundtrackSongs) || 0,
      efficiency: Number.isFinite(Number(summary.averageWhMi)) ? Number(summary.averageWhMi) : fallback.efficiency,
      autopilot: summary.autopilotMiles != null && Number.isFinite(Number(summary.autopilotMiles)) ? Number(summary.autopilotMiles) : fallback.autopilot,
      autopilotEligibleMiles: summary.autopilotEligibleMiles != null && Number.isFinite(Number(summary.autopilotEligibleMiles)) ? Number(summary.autopilotEligibleMiles) : fallback.autopilotEligibleMiles
    };
  }

  function percentChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return Math.round(((current - previous) / Math.abs(previous)) * 100);
  }

  function changeText(change) {
    if (change == null) return "New baseline";
    return `${change > 0 ? "+" : ""}${change}%`;
  }

  function setChange(id, change, inverse = false) {
    const target = byId(id);
    if (!target) return;
    target.textContent = changeText(change);
    const beneficial = change == null ? null : inverse ? change < 0 : change > 0;
    target.className = beneficial == null ? "neutral" : beneficial ? "positive" : "negative";
  }

  function setValue(id, value) {
    const target = byId(id);
    if (target) target.textContent = value;
  }

  let currentTrendData = null;
  let activeTrendIndex = null;

  function seriesWindows(range, now) {
    if (range === "weekly") {
      const currentWeek = startOfDay(now);
      currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
      return Array.from({ length: 12 }, (_, index) => {
        const start = new Date(currentWeek.getTime() - (11 - index) * 7 * dayMs);
        const end = new Date(start.getTime() + 7 * dayMs);
        const lastDay = new Date(end.getTime() - dayMs);
        const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const fullLabel = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${lastDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
        return { start, end, label, fullLabel };
      });
    }
    if (range === "monthly") {
      const month = new Date(now.getFullYear(), now.getMonth(), 1);
      return Array.from({ length: 12 }, (_, index) => {
        const start = new Date(month.getFullYear(), month.getMonth() - (11 - index), 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        const label = start.toLocaleDateString(undefined, { month: "short" });
        const fullLabel = start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        return { start, end, label, fullLabel };
      });
    }
    const today = startOfDay(now);
    return Array.from({ length: 30 }, (_, index) => {
      const start = new Date(today.getTime() - (29 - index) * dayMs);
      const end = new Date(start.getTime() + dayMs);
      const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const fullLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      return { start, end, label, fullLabel };
    });
  }

  function buildSeries(range, drives, now) {
    return seriesWindows(range, now).map(window => {
      const metrics = metricsFor(within(drives, window.start, window.end));
      return { ...window, ...metrics };
    });
  }

  function pathFor(points, key, bounds, maximum) {
    if (!points.length) return "";
    return points.map((point, index) => {
      const x = bounds.left + (index / Math.max(1, points.length - 1)) * bounds.width;
      const y = bounds.top + bounds.height - ((Number(point[key]) || 0) / maximum) * bounds.height;
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function clearTrendInspection() {
    activeTrendIndex = null;
    const inspection = byId("statisticsTrendInspection");
    if (inspection) {
      inspection.innerHTML = "";
      inspection.hidden = true;
      inspection.setAttribute("hidden", "hidden");
    }
    const announcement = byId("statisticsTrendAnnouncement");
    if (announcement) announcement.textContent = "";
  }

  function renderTrendInspection(index) {
    if (!currentTrendData || !currentTrendData.points.length) {
      clearTrendInspection();
      return;
    }
    const { points, bounds, maxMiles, maxEnergy } = currentTrendData;
    if (index == null || index < 0 || index >= points.length) {
      clearTrendInspection();
      return;
    }
    activeTrendIndex = index;
    const point = points[index];
    const x = bounds.left + (index / Math.max(1, points.length - 1)) * bounds.width;
    const yMiles = bounds.top + bounds.height - ((Number(point.miles) || 0) / maxMiles) * bounds.height;
    const yEnergy = bounds.top + bounds.height - ((Number(point.energy) || 0) / maxEnergy) * bounds.height;

    const width = 152;
    const height = 66;
    const tooltipX = x > (bounds.left + bounds.width / 2)
      ? Math.max(8, x - width - 12)
      : Math.min(760 - width - 8, x + 12);
    const minY = Math.min(yMiles, yEnergy);
    const tooltipY = Math.max(bounds.top, Math.min(bounds.top + bounds.height - height, minY - 20));

    const periodLabel = point.fullLabel || point.label;
    const milesValue = `${number(point.miles, 1)} mi`;
    const energyValue = `${number(point.energy, 1)} kWh`;

    const inspection = byId("statisticsTrendInspection");
    if (inspection) {
      inspection.removeAttribute("hidden");
      inspection.hidden = false;
      inspection.innerHTML = `<line class="statistics-trend-guide" x1="${x.toFixed(1)}" y1="${bounds.top}" x2="${x.toFixed(1)}" y2="${bounds.top + bounds.height}"/><circle class="statistics-trend-dot miles" cx="${x.toFixed(1)}" cy="${yMiles.toFixed(1)}" r="4.5"/><circle class="statistics-trend-dot energy" cx="${x.toFixed(1)}" cy="${yEnergy.toFixed(1)}" r="4.5"/><g class="statistics-trend-tooltip" transform="translate(${tooltipX.toFixed(1)}, ${tooltipY.toFixed(1)})"><rect class="tooltip-bg" width="${width}" height="${height}" rx="8"/><text class="tooltip-title" x="12" y="19">${escapeHtml(periodLabel)}</text><circle cx="16" cy="36" r="3.5" class="tooltip-marker miles"/><text class="tooltip-metric miles" x="25" y="40">${milesValue}</text><circle cx="16" cy="52" r="3.5" class="tooltip-marker energy"/><text class="tooltip-metric energy" x="25" y="56">${energyValue}</text></g>`;
    }

    const announcement = byId("statisticsTrendAnnouncement");
    if (announcement) {
      announcement.textContent = `${periodLabel}: ${number(point.miles, 1)} miles, ${number(point.energy, 1)} kilowatt-hours`;
    }
  }

  function renderTrend() {
    const chart = byId("statisticsTrendChart");
    if (!chart) return;
    const now = new Date();
    const points = buildSeries(currentRange, latestDrives, now);
    const bounds = { left: 48, top: 24, width: 664, height: 214 };
    const maxMiles = Math.max(1, ...points.map(point => point.miles));
    const maxEnergy = Math.max(1, ...points.map(point => point.energy));
    currentTrendData = { points, bounds, maxMiles, maxEnergy };
    const milesPath = pathFor(points, "miles", bounds, maxMiles);
    const energyPath = pathFor(points, "energy", bounds, maxEnergy);
    const labelStep = currentRange === "daily" ? 5 : currentRange === "weekly" ? 2 : 2;
    const grid = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const y = bounds.top + ratio * bounds.height;
      const miles = Math.round(maxMiles * (1 - ratio));
      const energy = Math.round(maxEnergy * (1 - ratio));
      return `<line x1="${bounds.left}" y1="${y}" x2="${bounds.left + bounds.width}" y2="${y}"/><text x="4" y="${y + 4}">${miles}</text><text class="right" x="756" y="${y + 4}">${energy}</text>`;
    }).join("");
    const labels = points.map((point, index) => index % labelStep === 0 || index === points.length - 1
      ? `<text class="axis-label" x="${(bounds.left + (index / Math.max(1, points.length - 1)) * bounds.width).toFixed(1)}" y="274">${escapeHtml(point.label)}</text>`
      : "").join("");
    const milesArea = `${milesPath} L${bounds.left + bounds.width},${bounds.top + bounds.height} L${bounds.left},${bounds.top + bounds.height} Z`;
    const energyArea = `${energyPath} L${bounds.left + bounds.width},${bounds.top + bounds.height} L${bounds.left},${bounds.top + bounds.height} Z`;
    chart.innerHTML = `<defs><linearGradient id="statisticsMilesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a64cff" stop-opacity=".28"/><stop offset="1" stop-color="#a64cff" stop-opacity="0"/></linearGradient><linearGradient id="statisticsEnergyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7847" stop-opacity=".2"/><stop offset="1" stop-color="#ff7847" stop-opacity="0"/></linearGradient></defs><g class="statistics-chart-grid">${grid}</g><path class="statistics-chart-area miles" d="${milesArea}"/><path class="statistics-chart-area energy" d="${energyArea}"/><path class="statistics-chart-line miles" d="${milesPath}"/><path class="statistics-chart-line energy" d="${energyPath}"/><g class="statistics-chart-labels">${labels}</g><text class="axis-title" x="4" y="14">Miles</text><text class="axis-title right" x="756" y="14">kWh</text><g id="statisticsTrendInspection" class="statistics-trend-inspection" hidden></g>`;
    if (activeTrendIndex != null && activeTrendIndex < points.length) {
      renderTrendInspection(activeTrendIndex);
    }
  }

  function sparklineMarkup(points, key) {
    const values = points.slice(-14).map(point => Number(point[key]) || 0);
    const maximum = Math.max(1, ...values);
    const coordinates = values.map((value, index) => `${(index / Math.max(1, values.length - 1) * 178).toFixed(1)},${(45 - (value / maximum) * 38).toFixed(1)}`).join(" ");
    return `<polyline points="${coordinates}"/>`;
  }

  function renderSparklines(daily) {
    document.querySelectorAll("[data-stat-spark]").forEach(svg => {
      const key = svg.dataset.statSpark;
      svg.innerHTML = sparklineMarkup(daily, key);
    });
  }

  function icon(type) {
    const paths = {
      miles: '<path d="M5 20 9.5 4M19 20 14.5 4M10.5 20l.5-3m1-4 .5-3m1-4 .5-2"/>',
      time: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
      efficiency: '<path d="m13 2-7 11h5l-1 9 8-12h-5z"/>',
      energy: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V2h6v3m-3 4-2 4h3l-1 4"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.miles}</svg>`;
  }

  function formatMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
  }

  function comparisonRow(type, label, value, previous, change, unit, inverse = false) {
    const beneficial = change == null ? null : inverse ? change < 0 : change > 0;
    const className = beneficial == null ? "neutral" : beneficial ? "positive" : "negative";
    return `<div class="statistics-comparison-row"><span class="statistics-comparison-icon">${icon(type)}</span><div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div><div><em class="${className}">${changeText(change)}</em><small>${previous == null ? "No prior baseline" : `vs ${escapeHtml(previous)}${unit ? ` ${unit}` : ""}`}</small></div></div>`;
  }

  function scoreFor(current, currentDrives) {
    if (!current.journeys) return { score: null, efficiency: 0, completeness: 0, consistency: 0 };
    const efficiency = current.efficiency == null ? 55 : clamp(Math.round(100 - Math.max(0, current.efficiency - 190) * .28), 35, 100);
    const complete = currentDrives.filter(drive => Number.isFinite(Number(drive.miles)) && Number.isFinite(Number(drive.durationMinutes))).length;
    const completeness = Math.round((complete / current.journeys) * 100);
    const activeDays = new Set(currentDrives.map(driveDate).filter(Boolean).map(dateKey)).size;
    const consistency = clamp(Math.round((activeDays / 15) * 100), 0, 100);
    return { score: Math.round(efficiency * .55 + completeness * .3 + consistency * .15), efficiency, completeness, consistency };
  }

  function scoreLabel(score) {
    if (score == null) return "Building your score";
    if (score >= 90) return "Exceptional rhythm";
    if (score >= 80) return "Great drive";
    if (score >= 70) return "Strong momentum";
    if (score >= 55) return "Finding your rhythm";
    return "Building your baseline";
  }

  function renderScore(score, journeys) {
    const gauge = byId("statisticsScoreGauge");
    if (gauge) gauge.style.setProperty("--score", score.score ?? 0);
    setValue("statisticsScore", score.score == null ? "--" : String(score.score));
    setValue("statisticsScoreLabel", scoreLabel(score.score));
    setValue("statisticsScoreContext", journeys ? `Calculated from ${journeys} journey${journeys === 1 ? "" : "s"} in the last 30 days.` : "Your next completed journey will start the score.");
    const details = byId("statisticsScoreDetails");
    if (details) details.innerHTML = [["Efficiency", score.efficiency], ["Telemetry", score.completeness], ["Consistency", score.consistency]].map(([label, value]) => `<div><span>${label}</span><i><b style="width:${value}%"></b></i><strong>${value}</strong></div>`).join("");
  }

  function renderLongest(drives) {
    const longest = [...drives].filter(drive => Number.isFinite(Number(drive.miles))).sort((left, right) => Number(right.miles) - Number(left.miles))[0];
    activeLongestDrive = longest || null;
    const card = document.querySelector(".statistics-longest") || byId("statisticsLongestCard");
    if (!longest) {
      setValue("statisticsLongestMiles", "--");
      setValue("statisticsLongestRoute", "No journeys in this window");
      setValue("statisticsLongestDate", "Last 30 days");
      if (card) {
        card.classList.remove("is-interactive");
        card.removeAttribute("tabindex");
        card.removeAttribute("role");
        card.removeAttribute("aria-label");
        card.removeAttribute("title");
      }
      return;
    }
    if (card) {
      card.classList.add("is-interactive");
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Open longest journey details: ${longest.startingLocation || "Journey start"} to ${longest.endingLocation || "Destination"}, ${number(longest.miles, 1)} miles`);
      card.setAttribute("title", "Open journey details");
    }
    const route = `${longest.startingLocation || "Journey start"} → ${longest.endingLocation || "Destination"}`;
    const date = driveDate(longest);
    setValue("statisticsLongestMiles", `${number(longest.miles, 1)} mi`);
    setValue("statisticsLongestRoute", route);
    setValue("statisticsLongestDate", longest.shortDateLabel || longest.dateLabel || (date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""));
    const art = byId("statisticsLongestRouteArt");
    if (art) {
      const seed = [...route].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const y1 = 92 - seed % 22;
      const y2 = 40 + seed % 26;
      art.innerHTML = `<defs><linearGradient id="statisticsRouteGradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#a64cff"/><stop offset=".52" stop-color="#ff534c"/><stop offset="1" stop-color="#ff9b58"/></linearGradient><filter id="statisticsRouteGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g class="route-grid"><path d="M0 22 300 4M0 58 300 40M0 96 300 78M35 0 10 130M95 0 70 130M155 0 130 130M215 0 190 130M275 0 250 130"/></g><path class="route-line" filter="url(#statisticsRouteGlow)" d="M20 ${y1} C70 ${y1 - 36},105 ${y1 + 20},145 ${y2} S220 ${y2 + 20},278 18"/><circle class="route-start" cx="20" cy="${y1}" r="6"/><circle class="route-end" cx="278" cy="18" r="7"/>`;
    }
  }

  function renderFavoriteDay(drives) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(name => ({ name, count: 0, miles: 0 }));
    drives.forEach(drive => {
      const date = driveDate(drive);
      if (!date) return;
      const day = days[date.getDay()];
      day.count += 1;
      day.miles += Number(drive.miles) || 0;
    });
    const favorite = [...days].sort((left, right) => right.count - left.count || right.miles - left.miles)[0];
    const total = drives.length;
    setValue("statisticsFavoriteDay", favorite?.count ? favorite.name : "--");
    setValue("statisticsFavoriteAverage", favorite?.count ? `Avg ${number(favorite.miles / favorite.count, 1)} mi` : "No journeys in this window");
    setValue("statisticsFavoriteShare", favorite?.count && total ? `${Math.round((favorite.count / total) * 100)}% of journeys` : "Last 30 days");
    const maximum = Math.max(1, ...days.map(day => day.count));
    const target = byId("statisticsWeekdayBars");
    if (target) target.innerHTML = days.map(day => `<div class="${day === favorite && day.count ? "favorite" : ""}" title="${day.count} journeys"><i style="height:${Math.max(8, Math.round((day.count / maximum) * 82))}%"></i><span>${day.name.slice(0, 1)}</span></div>`).join("");
  }

  function renderStreak(drives, now) {
    const activeDates = new Set(drives.map(driveDate).filter(Boolean).map(dateKey));
    let cursor = startOfDay(now);
    if (!activeDates.has(dateKey(cursor))) cursor = new Date(cursor.getTime() - dayMs);
    let streak = 0;
    while (activeDates.has(dateKey(cursor)) && streak < 730) {
      streak += 1;
      cursor = new Date(cursor.getTime() - dayMs);
    }
    setValue("statisticsStreakDays", `${streak} day${streak === 1 ? "" : "s"}`);
    setValue("statisticsStreakMessage", streak >= 7 ? "Keep it going!" : streak ? "Your recent rhythm" : "Your next journey starts a streak");
    const target = byId("statisticsStreakTrack");
    if (target) target.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfDay(now).getTime() - (6 - index) * dayMs);
      const active = activeDates.has(dateKey(date));
      return `<div class="${active ? "active" : ""}"><i>${active ? "✓" : ""}</i><span>${date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}</span></div>`;
    }).join("");
  }

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    const longestCard = document.querySelector(".statistics-longest") || byId("statisticsLongestCard");
    if (longestCard && !longestCard.dataset.boundLongest) {
      longestCard.dataset.boundLongest = "true";
      const triggerOpen = () => {
        if (activeLongestDrive && typeof activeOptions.openDrive === "function") {
          activeOptions.openDrive(activeLongestDrive);
        }
      };
      longestCard.addEventListener("click", event => {
        if (event.target?.closest?.("button, a, input, select, textarea")) return;
        triggerOpen();
      });
      longestCard.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        triggerOpen();
      });
    }
    document.querySelectorAll("[data-stat-range]").forEach(button => button.addEventListener("click", () => {
      currentRange = button.dataset.statRange || "daily";
      document.querySelectorAll("[data-stat-range]").forEach(item => item.classList.toggle("active", item === button));
      clearTrendInspection();
      renderTrend();
    }));

    const chartWrap = byId("statisticsChartWrap") || document.querySelector(".statistics-chart-wrap");
    const chart = byId("statisticsTrendChart");

    if (chart && !chart.dataset.boundTrendInspection) {
      chart.dataset.boundTrendInspection = "true";

      const resolvePointIndexFromEvent = event => {
        if (!currentTrendData || !currentTrendData.points.length) return null;
        const rect = chart.getBoundingClientRect();
        if (!rect || rect.width <= 0) return null;
        const clientX = Number(event.clientX);
        if (!Number.isFinite(clientX)) return null;
        const normalizedX = (clientX - rect.left) / rect.width;
        const svgX = normalizedX * 760;
        const { bounds, points } = currentTrendData;
        const clampedRatio = Math.max(0, Math.min(1, (svgX - bounds.left) / bounds.width));
        return Math.round(clampedRatio * (points.length - 1));
      };

      chart.addEventListener("pointerdown", event => {
        const index = resolvePointIndexFromEvent(event);
        if (index != null) renderTrendInspection(index);
      });
      chart.addEventListener("pointermove", event => {
        const index = resolvePointIndexFromEvent(event);
        if (index != null) renderTrendInspection(index);
      });
      chart.addEventListener("pointerleave", () => {
        clearTrendInspection();
      });
      chart.addEventListener("pointercancel", () => {
        clearTrendInspection();
      });
    }

    const keyboardTarget = chartWrap || chart;
    if (keyboardTarget && !keyboardTarget.dataset.boundTrendKeyboard) {
      keyboardTarget.dataset.boundTrendKeyboard = "true";
      if (!keyboardTarget.hasAttribute("tabindex")) keyboardTarget.setAttribute("tabindex", "0");
      if (!keyboardTarget.hasAttribute("role")) keyboardTarget.setAttribute("role", "region");
      if (!keyboardTarget.hasAttribute("aria-label")) keyboardTarget.setAttribute("aria-label", "Miles and energy over time trend chart");

      keyboardTarget.addEventListener("keydown", event => {
        if (!currentTrendData || !currentTrendData.points.length) return;
        const maxIdx = currentTrendData.points.length - 1;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          const nextIdx = activeTrendIndex == null ? maxIdx : Math.max(0, activeTrendIndex - 1);
          renderTrendInspection(nextIdx);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          const nextIdx = activeTrendIndex == null ? 0 : Math.min(maxIdx, activeTrendIndex + 1);
          renderTrendInspection(nextIdx);
        } else if (event.key === "Escape") {
          event.preventDefault();
          clearTrendInspection();
        }
      });
    }

    byId("statisticsScoreBreakdown")?.addEventListener("click", event => {
      const details = byId("statisticsScoreDetails");
      if (!details) return;
      details.hidden = !details.hidden;
      event.currentTarget.setAttribute("aria-expanded", String(!details.hidden));
    });
    byId("statisticsMonthlyArchiveButton")?.addEventListener("click", event => {
      const archive = byId("statisticsMonthlyArchive");
      if (!archive) return;
      archive.hidden = !archive.hidden;
      event.currentTarget.setAttribute("aria-expanded", String(!archive.hidden));
      event.currentTarget.firstChild.textContent = archive.hidden ? "View monthly archive " : "Hide monthly archive ";
      if (!archive.hidden) archive.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function render(summary, drives, options = {}) {
    activeOptions = options || {};
    latestSummary = summary || latestSummary;
    latestDrives = Array.isArray(drives) ? drives.filter(Boolean) : latestDrives;
    bindControls();
    const now = new Date();
    const end = new Date(now.getTime() + 1000);
    const currentStart = new Date(now.getTime() - 30 * dayMs);
    const previousStart = new Date(now.getTime() - 60 * dayMs);
    const currentDrives = within(latestDrives, currentStart, end);
    const previousDrives = within(latestDrives, previousStart, currentStart);
    const calculatedCurrent = metricsFor(currentDrives);
    const current = summaryMetrics(latestSummary, calculatedCurrent);
    const previous = metricsFor(previousDrives);
    const changes = {
      journeys: percentChange(current.journeys, previous.journeys),
      miles: percentChange(current.miles, previous.miles),
      efficiency: percentChange(current.efficiency, previous.efficiency),
      energy: percentChange(current.energy, previous.energy),
      battery: percentChange(current.battery, previous.battery),
      songs: percentChange(current.songs, previous.songs),
      minutes: percentChange(calculatedCurrent.minutes, previous.minutes),
      autopilot: percentChange(calculatedCurrent.autopilot, previous.autopilot)
    };

    setValue("statDriveCount", number(current.journeys));
    setValue("statMiles", number(current.miles, 1));
    setValue("statEfficiency", current.efficiency == null ? "--" : number(current.efficiency));
    setValue("statEnergy", number(current.energy, 1));
    setValue("statBattery", number(current.battery));
    setValue("statSongs", number(current.songs));
    setValue("statAutopilot", number(current.autopilot, 1));
    const autopilotShare = current.autopilot != null && current.autopilotEligibleMiles > 0
      ? `${number((current.autopilot / current.autopilotEligibleMiles) * 100)}% of Tessie-recorded miles`
      : "No Tessie Autopilot data in this window";
    setValue("statAutopilotShare", autopilotShare);
    setChange("statDriveCountChange", changes.journeys);
    setChange("statMilesChange", changes.miles);
    setChange("statEfficiencyChange", changes.efficiency, true);
    setChange("statEnergyChange", changes.energy);
    setChange("statBatteryChange", changes.battery);
    setChange("statSongsChange", changes.songs);
    setChange("statAutopilotChange", changes.autopilot);

    const comparison = byId("statisticsComparison");
    if (comparison) comparison.innerHTML = [
      comparisonRow("miles", "Miles", `${number(current.miles, 1)} mi`, number(previous.miles, 1), changes.miles, "mi"),
      comparisonRow("time", "Driving time", formatMinutes(calculatedCurrent.minutes), formatMinutes(previous.minutes), changes.minutes, ""),
      comparisonRow("efficiency", "Avg efficiency", current.efficiency == null ? "--" : `${number(current.efficiency)} Wh/mi`, previous.efficiency == null ? null : number(previous.efficiency), changes.efficiency, "Wh/mi", true),
      comparisonRow("energy", "Energy used", `${number(current.energy, 1)} kWh`, number(previous.energy, 1), changes.energy, "kWh")
    ].join("");

    const daily = buildSeries("daily", latestDrives, now);
    renderScore(scoreFor(calculatedCurrent, currentDrives), calculatedCurrent.journeys);
    renderSparklines(daily);
    renderTrend();
    renderLongest(currentDrives);
    renderFavoriteDay(currentDrives);
    renderStreak(latestDrives, now);
    document.querySelector("[data-statistics-dashboard]")?.classList.toggle("statistics-library-loading", !options.fullLibrary);
  }

  function renderError(error) {
    setValue("statisticsScoreContext", error?.message || "Statistics are temporarily unavailable.");
    document.querySelector("[data-statistics-dashboard]")?.classList.add("statistics-error");
  }

  window.DriveOSStatisticsDashboard = Object.freeze({ render, renderError });
})();
