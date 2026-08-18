(function () {
  const demoJourneys = Object.freeze([
    { id: "demo-1", startedAt: "2026-05-28T21:42:00", route: "Lakeview, ST \u2192 Riverton, ST", miles: 18.6, durationMinutes: 28 },
    { id: "demo-2", startedAt: "2026-05-28T19:05:00", route: "Pinecrest, ST \u2192 Harbor Point, ST", miles: 24.7, durationMinutes: 35 },
    { id: "demo-3", startedAt: "2026-05-28T06:11:00", route: "Home \u2192 Studio", miles: 6.3, durationMinutes: 14 },
    { id: "demo-4", startedAt: "2026-05-27T21:18:00", route: "Studio \u2192 Home", miles: 6.4, durationMinutes: 15 },
    { id: "demo-5", startedAt: "2026-05-26T20:36:00", route: "Lakeview, ST \u2192 Downtown", miles: 11.8, durationMinutes: 22 },
    { id: "demo-6", startedAt: "2026-05-25T17:24:00", route: "Harbor Point, ST \u2192 Pinecrest, ST", miles: 25.1, durationMinutes: 37 },
    { id: "demo-7", startedAt: "2026-05-24T09:08:00", route: "Home \u2192 Mountain Trail", miles: 42.3, durationMinutes: 58 },
    { id: "demo-8", startedAt: "2026-05-23T18:52:00", route: "Mountain Trail \u2192 Home", miles: 41.9, durationMinutes: 56 }
  ]);

  const memoryDefinitions = Object.freeze([
    { id: "everyday-life", title: "Everyday Life", miles: 412.8, journeys: 27, notes: "The familiar routes, quick errands, and ordinary days that quietly became part of the story.", collections: [{ name: "Daily rhythms", journeys: 12 }, { name: "Home and studio", journeys: 9 }, { name: "Evening errands", journeys: 6 }] },
    { id: "weekend-escapes", title: "Weekend Escapes", miles: 536.4, journeys: 31, notes: "Short drives, open views, and the weekends that felt farther away than they really were.", collections: [{ name: "Mountain weekends", journeys: 6 }, { name: "Favorite night drives", journeys: 7 }, { name: "Golden hour drives", journeys: 4 }, { name: "Unhurried Sundays", journeys: 14 }] },
    { id: "summer-2026", title: "Summer 2026", miles: 684.2, journeys: 18, notes: "Golden days, open roads, and the drives that made the season feel endless.", collections: [{ name: "Mountain weekends", journeys: 6 }, { name: "Favorite night drives", journeys: 7 }, { name: "Golden hour drives", journeys: 5 }] },
    { id: "sunday-drives", title: "Sunday Drives", miles: 298.6, journeys: 24, notes: "Slow starts, long routes home, and nowhere in particular to be.", collections: [{ name: "Morning coffee runs", journeys: 8 }, { name: "Scenic loops", journeys: 10 }, { name: "Sunset returns", journeys: 6 }] },
    { id: "road-trips", title: "Road Trips", miles: 1842.7, journeys: 40, notes: "Long stretches of highway, unfamiliar towns, and the soundtracks that carried every mile.", collections: [{ name: "Texas weekends", journeys: 12 }, { name: "Coastal routes", journeys: 16 }, { name: "Small-town stops", journeys: 12 }] },
    { id: "texas-weekends", title: "Texas Weekends", miles: 348.9, journeys: 11, notes: "A suggested memory built from repeated weekend routes across Texas.", collections: [{ name: "Hill Country", journeys: 5 }, { name: "City nights", journeys: 6 }] },
    { id: "golden-hour-drives", title: "Golden Hour Drives", miles: 227.1, journeys: 9, notes: "A suggested memory built from drives that began near sunset.", collections: [{ name: "Sunset returns", journeys: 5 }, { name: "Warm evening routes", journeys: 4 }] }
  ]);

  const state = {
    selectedMemory: 2,
    journeys: demoJourneys,
    expandedJourneys: false,
    statusTimer: 0,
    pointerStartX: null,
    activeMemoryIndex: 2,
    memoryDrafts: new Map(),
    editCollections: [],
    editPhotos: []
  };

  let mounted = false;

  const memoryCards = () => Array.from(document.querySelectorAll(".moments-memory-card"));

  function memoryName(card) {
    return card?.querySelector(".moments-memory-copy strong")?.textContent?.trim() || "Memory";
  }

  function showStatus(message) {
    const status = document.getElementById("momentsStatus");
    if (!status) return;
    window.clearTimeout(state.statusTimer);
    status.textContent = message;
    status.hidden = false;
    state.statusTimer = window.setTimeout(() => { status.hidden = true; }, 2600);
  }

  function createDots(cards) {
    const dots = document.querySelector(".moments-carousel-dots");
    if (!dots || dots.childElementCount === cards.length) return;
    dots.innerHTML = cards.map((card, index) => (
      `<button class="moments-carousel-dot" type="button" role="tab" data-memory-dot="${index}" aria-label="Show ${memoryName(card)}"></button>`
    )).join("");
    dots.querySelectorAll("[data-memory-dot]").forEach(dot => {
      dot.addEventListener("click", () => selectMemory(Number(dot.dataset.memoryDot)));
    });
  }

  function selectMemory(index, announce = true) {
    const cards = memoryCards();
    if (!cards.length) return;
    state.selectedMemory = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));

    cards.forEach((card, cardIndex) => {
      const rawOffset = cardIndex - state.selectedMemory;
      const visible = rawOffset >= -2 && rawOffset <= 4;
      const offset = Math.max(-3, Math.min(5, rawOffset));
      const magnitude = Math.abs(rawOffset);
      const scale = rawOffset === 0 ? 1 : Math.max(.68, .9 - Math.max(0, magnitude - 1) * .08);
      const y = rawOffset === 0 ? 0 : `${Math.min(46, 13 + magnitude * 8)}px`;
      const opacity = visible ? Math.max(.35, 1 - magnitude * .13) : 0;

      card.style.setProperty("--moments-offset", String(offset));
      card.style.setProperty("--moments-scale", String(scale));
      card.style.setProperty("--moments-y", y);
      card.style.setProperty("--moments-rotate-y", rawOffset === 0 ? "0deg" : `${rawOffset < 0 ? 7 : -7}deg`);
      card.style.setProperty("--moments-rotate-z", rawOffset === 0 ? "0deg" : `${rawOffset < 0 ? -.45 : .45}deg`);
      card.style.setProperty("--moments-opacity", String(opacity));
      card.style.setProperty("--moments-z", String(20 - magnitude));
      card.classList.toggle("is-selected", rawOffset === 0);
      card.toggleAttribute("aria-current", rawOffset === 0);
      card.setAttribute("aria-hidden", visible ? "false" : "true");
      card.tabIndex = rawOffset === 0 ? 0 : -1;
      card.style.pointerEvents = visible ? "auto" : "none";
    });

    document.querySelectorAll("[data-memory-dot]").forEach((dot, dotIndex) => {
      const active = dotIndex === state.selectedMemory;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
    });

    const previous = document.querySelector(".moments-carousel-previous");
    const next = document.querySelector(".moments-carousel-next");
    if (previous) previous.disabled = state.selectedMemory === 0;
    if (next) next.disabled = state.selectedMemory === cards.length - 1;

    const selectedName = memoryName(cards[state.selectedMemory]);
    document.querySelectorAll("[data-selected-memory]").forEach(label => { label.textContent = selectedName.toLocaleUpperCase(); });
    if (announce) showStatus(`${selectedName} selected`);
  }

  function memoryRecord(index = state.selectedMemory) {
    const card = memoryCards()[index];
    const definition = memoryDefinitions[index] || memoryDefinitions[0];
    const draft = state.memoryDrafts.get(definition.id) || {};
    return {
      ...definition,
      ...draft,
      cover: card?.querySelector("img")?.getAttribute("src") || "",
      collections: Array.isArray(draft.collections) ? draft.collections : definition.collections,
      photos: Array.isArray(draft.photos) ? draft.photos : []
    };
  }

  function renderMemoryCollections(collections, target) {
    if (!target) return;
    target.innerHTML = collections.map(collection => `<button class="memory-details-collection" type="button" data-memory-collection="${escape(collection.name)}">
      <span><strong>${escape(collection.name)}</strong><small>${escape(collection.journeys || 0)} journeys</small></span><i aria-hidden="true">\u203A</i>
    </button>`).join("");
    target.querySelectorAll("[data-memory-collection]").forEach(button => {
      button.addEventListener("click", () => {
        closeMemoryModal();
        document.dispatchEvent(new CustomEvent("journeydeck:editcollection", { detail: { collectionName: button.dataset.memoryCollection } }));
      });
    });
  }

  function renderMemoryDetails() {
    const memory = memoryRecord(state.activeMemoryIndex);
    const title = document.getElementById("memoryDetailsHeading");
    const cover = document.getElementById("memoryDetailsCover");
    if (title) title.textContent = memory.title;
    if (cover) { cover.src = memory.cover; cover.alt = `${memory.title} cover`; }
    const values = {
      memoryDetailsSummary: `${memory.collections.length} collections \u00b7 ${memory.journeys} journeys`,
      memoryDetailsMiles: `${Number(memory.miles).toLocaleString(undefined, { maximumFractionDigits: 1 })} mi`,
      memoryDetailsJourneyCount: String(memory.journeys),
      memoryDetailsCollectionCount: String(memory.collections.length),
      memoryDetailsPhotoCount: String(memory.photos.length),
      memoryDetailsNotes: memory.notes || "No notes yet.",
      memoryDetailsCollectionLabel: `${memory.collections.length} total`
    };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });

    const photos = document.getElementById("memoryDetailsPhotos");
    if (photos) photos.innerHTML = memory.photos.length
      ? memory.photos.map(photo => `<figure><img src="${escape(photo.url)}" alt="${escape(photo.name)}"><figcaption>${escape(photo.name)}</figcaption></figure>`).join("")
      : `<div class="memory-details-empty"><span aria-hidden="true">\u25A7</span><p>Add personal pictures while editing this memory.</p></div>`;
    renderMemoryCollections(memory.collections, document.getElementById("memoryDetailsCollections"));
  }

  function openMemoryModal(index) {
    state.activeMemoryIndex = index;
    renderMemoryDetails();
    document.getElementById("memoryEditForm")?.setAttribute("hidden", "");
    document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
    const modal = document.getElementById("memoryDetailsModal");
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector("[data-close-memory-modal]")?.focus();
  }

  function closeMemoryModal() {
    const modal = document.getElementById("memoryDetailsModal");
    if (!modal) return;
    discardMemoryEdits();
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("memoryEditForm")?.setAttribute("hidden", "");
    document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
  }

  function discardMemoryEdits() {
    state.editPhotos.filter(photo => photo.temporary).forEach(photo => URL.revokeObjectURL(photo.url));
    state.editCollections = [];
    state.editPhotos = [];
  }

  function renderMemoryEditCollections() {
    const target = document.getElementById("memoryEditCollections");
    if (!target) return;
    target.innerHTML = state.editCollections.map((collection, index) => `<div><span><strong>${escape(collection.name)}</strong><small>${escape(collection.journeys || 0)} journeys</small></span><button type="button" data-remove-memory-collection="${index}" aria-label="Remove ${escape(collection.name)}">Remove</button></div>`).join("");
    target.querySelectorAll("[data-remove-memory-collection]").forEach(button => button.addEventListener("click", () => {
      state.editCollections.splice(Number(button.dataset.removeMemoryCollection), 1);
      renderMemoryEditCollections();
    }));
  }

  function renderMemoryEditPhotos() {
    const target = document.getElementById("memoryEditPhotos");
    if (!target) return;
    target.innerHTML = state.editPhotos.length
      ? state.editPhotos.map((photo, index) => `<figure><img src="${escape(photo.url)}" alt="${escape(photo.name)}"><button type="button" data-remove-memory-photo="${index}" aria-label="Remove ${escape(photo.name)}">\u00d7</button><figcaption>${escape(photo.name)}</figcaption></figure>`).join("")
      : `<p class="memory-edit-help">No personal pictures added yet.</p>`;
    target.querySelectorAll("[data-remove-memory-photo]").forEach(button => button.addEventListener("click", () => {
      const [removed] = state.editPhotos.splice(Number(button.dataset.removeMemoryPhoto), 1);
      if (removed?.temporary) URL.revokeObjectURL(removed.url);
      renderMemoryEditPhotos();
    }));
  }

  function showMemoryEditor() {
    const memory = memoryRecord(state.activeMemoryIndex);
    state.editCollections = memory.collections.map(collection => ({ ...collection }));
    state.editPhotos = memory.photos.map(photo => ({ ...photo }));
    document.getElementById("memoryDetailsView")?.setAttribute("hidden", "");
    document.getElementById("memoryEditForm")?.removeAttribute("hidden");
    const title = document.getElementById("memoryEditTitle");
    const notes = document.getElementById("memoryEditNotes");
    if (title) title.value = memory.title;
    if (notes) notes.value = memory.notes || "";
    const message = document.getElementById("memoryEditMessage");
    if (message) message.textContent = "";
    renderMemoryEditCollections();
    renderMemoryEditPhotos();
    title?.focus();
  }

  function addMemoryCollection() {
    const input = document.getElementById("memoryEditCollectionInput");
    const name = input?.value.trim();
    if (!name) return;
    if (state.editCollections.some(collection => collection.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      const message = document.getElementById("memoryEditMessage");
      if (message) message.textContent = "That collection is already in this memory.";
      return;
    }
    state.editCollections.push({ name, journeys: 0 });
    input.value = "";
    renderMemoryEditCollections();
  }

  function saveMemory(event) {
    event.preventDefault();
    const definition = memoryDefinitions[state.activeMemoryIndex];
    const title = document.getElementById("memoryEditTitle")?.value.trim();
    if (!definition || !title) return;
    state.editPhotos = state.editPhotos.map(photo => ({ ...photo, temporary: false }));
    state.memoryDrafts.set(definition.id, {
      title,
      notes: document.getElementById("memoryEditNotes")?.value.trim() || "",
      collections: state.editCollections.map(collection => ({ ...collection })),
      photos: state.editPhotos.map(photo => ({ ...photo }))
    });
    const card = memoryCards()[state.activeMemoryIndex];
    const cardTitle = card?.querySelector(".moments-memory-copy strong");
    const cardMeta = card?.querySelector(".moments-memory-copy small");
    if (cardTitle) cardTitle.textContent = title;
    if (cardMeta) cardMeta.textContent = `${state.editCollections.length} collections \u00b7 ${definition.journeys} journeys`;
    renderMemoryDetails();
    document.getElementById("memoryEditForm")?.setAttribute("hidden", "");
    document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
    showStatus(`${title} updated for this session`);
  }

  function normalizedJourney(drive) {
    const start = String(drive.startingLocation || drive.rawStartingLocation || "").trim();
    const end = String(drive.endingLocation || drive.rawEndingLocation || "").trim();
    const route = String(drive.route || `${start || "Start"} \u2192 ${end || "Destination"}`).trim();
    return {
      id: drive.id || "",
      startedAt: drive.startedAt || drive.dateIso || drive.dateNumeric || "",
      route,
      miles: Number.isFinite(Number(drive.miles)) ? Number(drive.miles) : 0,
      durationMinutes: Number.isFinite(Number(drive.durationMinutes)) ? Number(drive.durationMinutes) : 0
      ,source: drive
    };
  }

  function dateParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: "Recent", time: "" };
    return {
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    };
  }

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function renderJourneys(drives = state.journeys) {
    const rows = document.getElementById("momentsJourneyRows");
    if (!rows) return;
    const normalized = (Array.isArray(drives) && drives.length ? drives : demoJourneys)
      .map(normalizedJourney)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
      .slice(0, 8);
    state.journeys = normalized.length ? normalized : demoJourneys;
    const visible = state.expandedJourneys ? state.journeys : state.journeys.slice(0, 4);

    rows.innerHTML = visible.map(journey => {
      const parts = dateParts(journey.startedAt);
      const miles = Number(journey.miles).toFixed(1).replace(/\.0$/, "");
      return `<div class="moments-journey-row" role="row" tabindex="0" data-moments-open-journey="${escape(journey.id)}">
        <span class="moments-journey-date" role="cell">${escape(parts.date)} &nbsp; ${escape(parts.time)}</span>
        <span class="moments-journey-route" role="cell">${escape(journey.route)}</span>
        <span class="moments-journey-distance" role="cell">${escape(miles)} mi</span>
        <span class="moments-journey-duration" role="cell">${escape(journey.durationMinutes)} min</span>
        <button class="moments-journey-add" type="button" data-moments-add-journey="${escape(journey.id)}">+ &nbsp; Add to collection</button>
      </div>`;
    }).join("");

    rows.querySelectorAll("[data-moments-add-journey]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent("journeydeck:addtocollection", { detail: { driveId: button.dataset.momentsAddJourney || null } }));
      });
    });
    rows.querySelectorAll("[data-moments-open-journey]").forEach((row, rowIndex) => {
      const open = () => {
        const journey = visible[rowIndex];
        document.dispatchEvent(new CustomEvent("journeydeck:openjourney", { detail: { driveId: journey.id || null, drive: journey.source || journey } }));
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      });
    });

    const viewAll = document.querySelector("[data-moments-view-all]");
    if (viewAll) viewAll.textContent = state.expandedJourneys ? "Show newest four \u2191" : "View all journeys \u2192";
  }

  function setJourneys(drives) {
    if (!Array.isArray(drives) || !drives.length) return;
    renderJourneys(drives);
  }

  function setCollections() {
    // Collection art and titles stay deterministic for the approved demo.
    // This hook is intentionally present so live records can replace them later.
  }

  function bindCarousel() {
    const cards = memoryCards();
    createDots(cards);
    cards.forEach(card => card.addEventListener("click", () => {
      const index = Number(card.dataset.memoryIndex);
      selectMemory(index);
      openMemoryModal(index);
    }));
    document.querySelector(".moments-carousel-previous")?.addEventListener("click", () => selectMemory(state.selectedMemory - 1));
    document.querySelector(".moments-carousel-next")?.addEventListener("click", () => selectMemory(state.selectedMemory + 1));

    const carousel = document.querySelector(".moments-memory-carousel");
    carousel?.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") { event.preventDefault(); selectMemory(state.selectedMemory - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); selectMemory(state.selectedMemory + 1); }
    });
    carousel?.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse") return;
      state.pointerStartX = event.clientX;
    }, { passive: true });
    carousel?.addEventListener("pointerup", event => {
      if (state.pointerStartX == null) return;
      const distance = event.clientX - state.pointerStartX;
      state.pointerStartX = null;
      if (Math.abs(distance) < 42) return;
      selectMemory(state.selectedMemory + (distance < 0 ? 1 : -1));
    }, { passive: true });
  }

  function bindActions() {
    document.addEventListener("click", event => {
      if (!event.target.closest("[data-close-memory-modal]")) return;
      event.preventDefault();
      event.stopPropagation();
      closeMemoryModal();
    }, true);
    document.getElementById("memoryEditButton")?.addEventListener("click", showMemoryEditor);
    document.getElementById("memoryEditCancel")?.addEventListener("click", () => {
      discardMemoryEdits();
      document.getElementById("memoryEditForm")?.setAttribute("hidden", "");
      document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
    });
    document.getElementById("memoryEditAddCollection")?.addEventListener("click", addMemoryCollection);
    document.getElementById("memoryEditCollectionInput")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addMemoryCollection();
    });
    document.getElementById("memoryEditPhotoInput")?.addEventListener("change", event => {
      const message = document.getElementById("memoryEditMessage");
      const files = Array.from(event.target.files || []);
      for (const file of files) {
        if (state.editPhotos.length >= 6) { if (message) message.textContent = "A memory can hold up to 6 preview photos."; break; }
        if (file.size > 8 * 1024 * 1024) { if (message) message.textContent = `${file.name} is larger than 8 MB.`; continue; }
        state.editPhotos.push({ name: file.name, size: file.size, url: URL.createObjectURL(file), temporary: true });
      }
      event.target.value = "";
      renderMemoryEditPhotos();
    });
    document.getElementById("memoryEditForm")?.addEventListener("submit", saveMemory);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && document.getElementById("memoryDetailsModal")?.classList.contains("open")) closeMemoryModal();
    });
    document.querySelector("[data-moments-new-collection]")?.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("journeydeck:addtocollection", { detail: { driveId: null } }));
    });
    document.querySelector("[data-moments-view-all]")?.addEventListener("click", () => {
      state.expandedJourneys = !state.expandedJourneys;
      renderJourneys();
    });
    document.querySelectorAll("[data-collection-name]").forEach(card => {
      card.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("journeydeck:editcollection", { detail: { collectionName: card.dataset.collectionName } }));
      });
    });
    document.addEventListener("journeydeck:viewchange", event => {
      document.body.classList.toggle("moments-view-active", event.detail?.view === "drives");
    });
  }

  function mount() {
    if (mounted || !document.querySelector(".moments-page")) return;
    mounted = true;
    bindCarousel();
    bindActions();
    renderJourneys();
    selectMemory(2, false);
    document.body.classList.toggle("moments-view-active", (location.hash || "#dashboard") === "#drives");
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.moments = Object.freeze({ mount, setJourneys, setCollections, renderJourneys, selectMemory, openMemoryModal });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
