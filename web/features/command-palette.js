(function () {
  const $ = window.DriveOSDom.byId;

  function create({ state, actions, api }) {
    const groupOrder = ["Actions", "Drives", "Places", "Songs", "Settings"];
    let results = [];
    let selectedIndex = 0;
    let returnFocus = null;
    let assistantAnswer = null;
    let assistantBusy = false;

    function normalize(value) {
      return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }

    function looksLikeQuestion(value) {
      const question = String(value || "").trim();
      const words = normalize(question).split(" ").filter(Boolean);
      return question.endsWith("?") ||
        /^(who|what|when|where|why|how|which|show me|tell me)\b/i.test(question) ||
        words.length >= 4;
    }

    function relevance(item, query) {
      const title = normalize(item.title);
      if (title === query) return 0;
      if (title.startsWith(query)) return 1;
      const titleMatch = title.indexOf(query);
      return titleMatch >= 0 ? 2 + (titleMatch / 100) : 3;
    }

    function driveTitle(drive) {
      return drive.dateLabel || drive.shortDateLabel || "Drive";
    }

    function driveRoute(drive) {
      const start = drive.startingLocation || drive.rawStartingLocation || "Drive start";
      const end = drive.endingLocation || drive.rawEndingLocation || "Drive end";
      return `${start} \u2192 ${end}`;
    }

    function buildResults() {
      const items = [
        { group: "Actions", icon: "\u2726", title: "Refresh driving and music data", detail: "Sync Tessie, Spotify, and Last.fm", type: "Action", run: actions.refresh },
        { group: "Actions", icon: "\u2197", title: "Open drive library", detail: "Browse and filter your complete drive history", type: "Action", run: () => actions.showView("drives") },
        { group: "Actions", icon: "\u266B", title: "Explore music by location", detail: "Find songs connected to the places you drive", type: "Action", run: () => actions.showView("music") },
        { group: "Actions", icon: "\u25A3", title: "Create a share card", detail: "Build a privacy-safe recap from your latest drive", type: "Action", disabled: !state.drives.length, run: () => actions.openShareCard(state.drives[0]) }
      ];

      (state.drives || []).slice(0, 80).forEach(drive => {
        const soundtrack = (drive.soundtrack || []).map(song => `${song.track || ""} ${song.artist || ""}`).join(" ");
        items.push({
          group: "Drives", icon: "\u2197", title: driveTitle(drive),
          detail: `${driveRoute(drive)} \u00B7 ${drive.miles ?? "--"} mi \u00B7 ${drive.durationMinutes ?? "--"} min`,
          type: "Drive", terms: soundtrack, run: () => actions.openDrive(drive)
        });
      });

      (state.placeCandidates || []).slice(0, 60).forEach(place => {
        const title = place.displayName || place.manualLabel || place.label || place.location || "Drive location";
        items.push({
          group: "Places", icon: "\u25CF", title,
          detail: `${place.uses || 0} drive endpoint${Number(place.uses) === 1 ? "" : "s"}${place.businessCategory ? ` \u00B7 ${place.businessCategory}` : ""}`,
          type: "Place", terms: place.location || "", run: actions.openPlaces
        });
      });

      const songs = new Map();
      (state.drives || []).forEach(drive => (drive.soundtrack || []).forEach(song => {
        if (!song.track) return;
        const key = normalize(`${song.track}|${song.artist}`);
        const existing = songs.get(key);
        if (existing) { existing.count++; return; }
        songs.set(key, { song, drive, count: 1 });
      }));
      [...songs.values()].sort((a, b) => b.count - a.count).slice(0, 80).forEach(({ song, drive, count }) => {
        items.push({
          group: "Songs", icon: "\u266B", title: song.track,
          detail: `${song.artist || "Unknown artist"} \u00B7 played ${count} time${count === 1 ? "" : "s"}`,
          type: "Song", terms: `${song.album || ""} ${driveRoute(drive)}`, run: () => actions.openDrive(drive)
        });
      });

      items.push(
        { group: "Settings", icon: "\u263E", title: "Use dark appearance", detail: "Switch JourneyDeck to the dark theme", type: "Setting", run: () => actions.setTheme("dark") },
        { group: "Settings", icon: "\u2600", title: "Use light appearance", detail: "Switch JourneyDeck to the light theme", type: "Setting", run: () => actions.setTheme("light") },
        { group: "Settings", icon: "\u2316", title: "Manage friendly places", detail: "Name Home, Work, School, and frequent stops", type: "Setting", run: actions.openPlaces }
      );
      return items;
    }

    function matches(item, query) {
      const haystack = normalize(`${item.title} ${item.detail} ${item.type} ${item.group} ${item.terms || ""}`);
      return query.split(" ").every(token => haystack.includes(token));
    }

    function visibleResults() {
      const query = normalize($("commandPaletteInput")?.value);
      const all = buildResults().filter(item => !item.disabled && (!query || matches(item, query)));
      if (query) {
        const naturalQuestion = String($("commandPaletteInput")?.value || "").trim();
        const askItem = naturalQuestion.length >= 3 ? [{
          group: "Ask JourneyDeck", icon: "✦", title: `Ask JourneyDeck: ${naturalQuestion}`,
          detail: "Answer using your saved drives, music, places, and charging records", type: "Answer",
          run: () => ask(naturalQuestion)
        }] : [];
        const matches = all.sort((a, b) => {
          return relevance(a, query) - relevance(b, query) ||
            groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
        }).slice(0, 29);
        return (looksLikeQuestion(naturalQuestion)
          ? askItem.concat(matches)
          : matches.concat(askItem)).slice(0, 30);
      }
      const limits = { Actions: 4, Drives: 3, Places: 2, Songs: 3, Settings: 3 };
      const counts = {};
      return all.filter(item => {
        counts[item.group] = (counts[item.group] || 0) + 1;
        return counts[item.group] <= limits[item.group];
      });
    }

    function makeResult(item, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `command-result${index === selectedIndex ? " selected" : ""}`;
      button.dataset.commandIndex = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");

      const icon = document.createElement("span");
      icon.className = "command-result-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon;
      const copy = document.createElement("span");
      copy.className = "command-result-copy";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const detail = document.createElement("span");
      detail.textContent = item.detail;
      copy.append(title, detail);
      const type = document.createElement("span");
      type.className = "command-result-type";
      type.textContent = item.type;
      button.append(icon, copy, type);
      button.addEventListener("mouseenter", () => { selectedIndex = index; updateSelection(); });
      button.addEventListener("click", () => execute(index));
      return button;
    }

    function render() {
      const container = $("commandPaletteResults");
      if (!container) return;
      results = visibleResults();
      selectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
      container.replaceChildren();
      if (assistantBusy) {
        const loading = document.createElement("div");
        loading.className = "command-empty";
        loading.textContent = "Checking your JourneyDeck records…";
        container.appendChild(loading);
        return;
      }
      if (assistantAnswer) {
        const answer = document.createElement("section");
        answer.className = "command-answer";
        const label = document.createElement("div");
        label.className = "command-group-label";
        label.textContent = "Ask JourneyDeck";
        const title = document.createElement("strong");
        title.textContent = assistantAnswer.answer || "No answer available.";
        const detail = document.createElement("p");
        const evidence = Array.isArray(assistantAnswer.evidence) ? assistantAnswer.evidence : [];
        detail.textContent = evidence.length
          ? `Based on ${evidence.length} evidence item${evidence.length === 1 ? "" : "s"}. ${assistantAnswer.filters?.periodDays ? `Period: last ${assistantAnswer.filters.periodDays} days.` : ""}`
          : "No matching records were needed for this answer.";
        answer.append(label, title, detail);

        if (evidence.length) {
          const evidenceList = document.createElement("div");
          evidenceList.className = "command-answer-evidence";
          evidence.slice(0, 5).forEach(item => {
            const chip = document.createElement("span");
            if (item.type === "drive") chip.textContent = `${item.date || "Drive"} · ${item.miles ?? "--"} mi · ${item.route || "Route unavailable"}`;
            else if (item.type === "track") chip.textContent = `${item.track || "Track"}${item.artist ? ` · ${item.artist}` : ""}${item.plays ? ` · ${item.plays} plays` : ""}`;
            else if (item.type === "artist") chip.textContent = `${item.artist || "Artist"} · ${item.plays || 0} plays`;
            else if (item.type === "place") chip.textContent = `${item.name || "Place"} · ${item.uses || 0} endpoints`;
            else if (item.type === "charging") chip.textContent = `${item.sessions || 0} sessions · ${item.energyAddedKWh || 0} kWh`;
            else if (item.type === "drives") chip.textContent = `${item.count || 0} drives${item.miles != null ? ` · ${item.miles} mi` : ""}${item.efficiencyWhMi != null ? ` · ${item.efficiencyWhMi} Wh/mi` : ""}`;
            else chip.textContent = "JourneyDeck record";
            evidenceList.appendChild(chip);
          });
          answer.appendChild(evidenceList);
        }

        const suggestions = Array.isArray(assistantAnswer.suggestions) ? assistantAnswer.suggestions : [];
        if (assistantAnswer.operation === "unsupported" && suggestions.length) {
          const suggestionList = document.createElement("div");
          suggestionList.className = "command-answer-suggestions";
          suggestions.slice(0, 4).forEach(suggestion => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = suggestion;
            button.addEventListener("click", () => {
              const input = $("commandPaletteInput");
              if (input) input.value = suggestion;
              assistantAnswer = null;
              selectedIndex = 0;
              render();
              input?.focus();
            });
            suggestionList.appendChild(button);
          });
          answer.appendChild(suggestionList);
        }
        container.appendChild(answer);
        return;
      }
      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "command-empty";
        empty.textContent = "No drives, places, songs, settings, or actions match that search.";
        container.appendChild(empty);
        return;
      }
      let lastGroup = "";
      results.forEach((item, index) => {
        if (item.group !== lastGroup) {
          const label = document.createElement("div");
          label.className = "command-group-label";
          label.textContent = item.group;
          container.appendChild(label);
          lastGroup = item.group;
        }
        container.appendChild(makeResult(item, index));
      });
    }

    function updateSelection() {
      $("commandPaletteResults")?.querySelectorAll("[data-command-index]").forEach(button => {
        const selected = Number(button.dataset.commandIndex) === selectedIndex;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", selected ? "true" : "false");
        if (selected) button.scrollIntoView({ block: "nearest" });
      });
    }

    function execute(index) {
      const item = results[index];
      if (!item) return;
      if (item.group === "Ask JourneyDeck") {
        Promise.resolve().then(item.run).catch(error => console.error("JourneyDeck answer failed:", error));
        return;
      }
      close();
      Promise.resolve().then(item.run).catch(error => console.error("Command palette action failed:", error));
    }

    async function ask(question) {
      if (!api || assistantBusy) return;
      assistantBusy = true;
      assistantAnswer = null;
      render();
      try {
        assistantAnswer = await api.post("/api/assistant/query", { question });
      } catch (error) {
        assistantAnswer = { answer: error.message || "JourneyDeck could not answer that question.", evidence: [] };
      } finally {
        assistantBusy = false;
        render();
      }
    }

    function open() {
      const palette = $("commandPalette");
      const input = $("commandPaletteInput");
      if (!palette || !input) return;
      returnFocus = document.activeElement;
      palette.classList.add("open");
      palette.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      input.value = "";
      selectedIndex = 0;
      assistantAnswer = null;
      assistantBusy = false;
      render();
      requestAnimationFrame(() => input.focus());
    }

    function close() {
      const palette = $("commandPalette");
      if (!palette?.classList.contains("open")) return;
      palette.classList.remove("open");
      palette.setAttribute("aria-hidden", "true");
      const otherModalOpen = [...document.querySelectorAll(".modal")].some(modal => modal.classList.contains("open"));
      document.body.style.overflow = otherModalOpen ? "hidden" : "";
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    }

    function bind() {
      $("commandPaletteButton")?.addEventListener("click", open);
      $("commandPaletteInput")?.addEventListener("input", () => { assistantAnswer = null; selectedIndex = 0; render(); });
      $("commandPalette")?.addEventListener("click", event => {
        if (event.target.closest("[data-close-command-palette]")) close();
      });
      document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          $("commandPalette")?.classList.contains("open") ? close() : open();
          return;
        }
        if (!$("commandPalette")?.classList.contains("open")) return;
        if (event.key === "Escape") { event.preventDefault(); close(); }
        if (event.key === "ArrowDown") { event.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, results.length - 1); updateSelection(); }
        if (event.key === "ArrowUp") { event.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); updateSelection(); }
        if (event.key === "Enter") { event.preventDefault(); execute(selectedIndex); }
      });
    }

    return Object.freeze({ open, close, render, bind });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.commandPalette = Object.freeze({ create });
})();
