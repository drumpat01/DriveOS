(function () {
  const api = window.DriveOSApi;
  const MAX_IMAGE_BYTES = 1572864;
  const demoJourneys = Object.freeze([
    { id: "demo-1", startedAt: "2026-05-28T21:42:00", route: "Lakeview, ST \u2192 Riverton, ST", miles: 18.6, durationMinutes: 28, songCount: 4 },
    { id: "demo-2", startedAt: "2026-05-28T19:05:00", route: "Pinecrest, ST \u2192 Harbor Point, ST", miles: 24.7, durationMinutes: 35, songCount: 7 },
    { id: "demo-3", startedAt: "2026-05-28T06:11:00", route: "Home \u2192 Studio", miles: 6.3, durationMinutes: 14, songCount: 7 }
  ]);
  const previews = Object.freeze([
    { id: "everyday-life", name: "Everyday Life", artworkKey: "everyday-life", notes: "The familiar routes, quick errands, and ordinary days that quietly became part of the story.", collectionNames: ["Daily rhythms", "Home and studio", "Evening errands"] },
    { id: "weekend-escapes", name: "Weekend Escapes", artworkKey: "weekend-escapes", notes: "Short drives, open views, and the weekends that felt farther away than they really were.", collectionNames: ["Mountain weekends", "Favorite night drives", "Golden hour drives"] },
    { id: "summer-2026", name: "Summer 2026", artworkKey: "summer-2026", notes: "Golden days, open roads, and the drives that made the season feel endless.", collectionNames: ["Mountain weekends", "Favorite night drives", "Golden hour drives", "Summer"] },
    { id: "sunday-drives", name: "Sunday Drives", artworkKey: "sunday-drives", notes: "Slow starts, long routes home, and nowhere in particular to be.", collectionNames: ["Morning coffee runs", "Scenic loops", "Sunset returns"] },
    { id: "road-trips", name: "Road Trips", artworkKey: "road-trips", notes: "Long stretches of highway, unfamiliar towns, and the soundtracks that carried every mile.", collectionNames: ["Texas weekends", "Coastal routes", "Small-town stops"] }
  ]);
  const artworkFiles = Object.freeze({
    "everyday-life": "everyday-life.jpg", "weekend-escapes": "weekend-escapes.jpg", "summer-2026": "summer-2026.jpg",
    "sunday-drives": "sunday-drives.jpg", "road-trips": "road-trips.jpg", "texas-weekends": "texas-weekends.jpg",
    "golden-hour-drives": "golden-hour-memory.jpg"
  });
  const collectionArtwork = Object.freeze({
    "mountain-weekends": "mountain-weekends.jpg", "favorite-night-drives": "favorite-night-drives.jpg",
    "golden-hour-drives": "golden-hour-collection.jpg"
  });
  const fallbackCollectionFiles = ["mountain-weekends.jpg", "favorite-night-drives.jpg", "golden-hour-collection.jpg"];
  const state = {
    selectedMemory: 2, activeMemoryIndex: 2, records: [], journeys: demoJourneys, collections: [], memories: [], suggestions: [],
    expandedJourneys: false, pointerStartX: null, statusTimer: 0, editCollections: [], editPhotos: [], memoryPhotos: new Map(),
    collectionHeroes: new Map(), collectionHeroPromises: new Map(), pickerJourneyId: null,
    pickerSelectedJourneyIds: new Set(), pickerCreatePhotos: [], searchQueries: { memories: "", collections: "", journeys: "" }, mounted: false
  };

  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const collectionChevron = '<i aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M7 4l6 6-6 6"/></svg></i>';
  const slug = value => String(value || "").toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const memoryCards = () => Array.from(document.querySelectorAll(".moments-memory-card"));
  const memoryAsset = key => `/assets/moments/${artworkFiles[key] || artworkFiles["summer-2026"]}?v=2`;
  const collectionAsset = (collection, index = 0) => `/assets/moments/${collectionArtwork[slug(collection?.name)] || fallbackCollectionFiles[index % fallbackCollectionFiles.length]}?v=2`;
  const collectionById = id => state.collections.find(collection => String(collection.id) === String(id));
  const collectionJourneyCount = collection => new Set(collection?.driveIds || []).size;
  const searchValue = value => String(value || "").trim().toLocaleLowerCase();
  const searchMatches = (value, query) => !query || searchValue(value).includes(query);

  function updateSearchCount(category, matches, total) {
    const count = document.querySelector(`[data-moments-search-count="${category}"]`), query = state.searchQueries[category];
    if (!count) return;
    count.hidden = !query; count.textContent = query ? String(matches) : "";
    count.title = query ? `${matches} of ${total} match` : "";
  }

  function applyMemorySearch() {
    const query = state.searchQueries.memories;
    let matches = 0;
    memoryCards().forEach((card, index) => {
      const record = state.records[index] || {}, memory = memoryRecord(index), match = searchMatches(`${record.title} ${record.notes || ""} ${memory.collections.map(item => item.name).join(" ")}`, query);
      if (match) matches++;
      card.classList.toggle("is-filter-match", Boolean(query && match));
      card.classList.toggle("is-filter-dimmed", Boolean(query && !match));
    });
    updateSearchCount("memories", matches, state.records.length);
  }

  function applyCollectionSearch() {
    const query = state.searchQueries.collections, cards = Array.from(document.querySelectorAll(".moments-collection-grid .moments-collection-card"));
    let matches = 0;
    cards.forEach(card => {
      const match = searchMatches(card.textContent, query); if (match) matches++;
      card.classList.toggle("is-filter-match", Boolean(query && match));
      card.classList.toggle("is-filter-dimmed", Boolean(query && !match));
    });
    updateSearchCount("collections", matches, cards.length);
  }

  function setSearchOpen(category, open) {
    document.querySelectorAll("[data-moments-search]").forEach(wrapper => {
      const active = open && wrapper.dataset.momentsSearch === category;
      wrapper.classList.toggle("is-open", active);
      wrapper.querySelector("[data-moments-search-toggle]")?.setAttribute("aria-expanded", String(active));
      wrapper.querySelector(".moments-search-pill")?.setAttribute("aria-hidden", String(!active));
      wrapper.querySelectorAll(".moments-search-pill input, .moments-search-pill button").forEach(control => { control.tabIndex = active ? 0 : -1; });
    });
    if (open) window.setTimeout(() => document.querySelector(`[data-moments-search-input="${category}"]`)?.focus(), 40);
  }

  function clearSectionSearch(category) {
    state.searchQueries[category] = "";
    const input = document.querySelector(`[data-moments-search-input="${category}"]`); if (input) input.value = "";
    if (category === "memories") applyMemorySearch();
    if (category === "collections") applyCollectionSearch();
    if (category === "journeys") renderJourneys();
    setSearchOpen(category, false);
  }

  function showStatus(message) {
    const status = document.getElementById("momentsStatus");
    if (!status) return;
    clearTimeout(state.statusTimer);
    status.textContent = message;
    status.hidden = false;
    state.statusTimer = setTimeout(() => { status.hidden = true; }, 3000);
  }

  function previewCollectionIds(preview) {
    const wanted = new Set((preview.collectionNames || []).map(name => name.toLocaleLowerCase()));
    const matched = state.collections.filter(collection => wanted.has(String(collection.name || "").toLocaleLowerCase()));
    const result = [...matched];
    for (const collection of state.collections) {
      if (result.length >= 4) break;
      if (!result.some(item => item.id === collection.id)) result.push(collection);
    }
    return result.map(collection => collection.id);
  }

  function buildRecords() {
    const saved = state.memories.map(memory => ({ ...memory, title: memory.name, saved: true }));
    const savedNames = new Set(saved.map(memory => memory.title.toLocaleLowerCase()));
    const isLocalPreview = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
    const previewRecord = preview => ({ ...preview, title: preview.name, collectionIds: previewCollectionIds(preview), preview: true });
    // Localhost is the design sandbox, so keep the complete demo carousel there
    // and replace a preview in-place when a real Memory has the same name. This
    // preserves the intended two-before/two-after carousel without presenting
    // demo records as saved account data on the production site.
    const savedByName = new Map(saved.map(memory => [memory.title.toLocaleLowerCase(), memory]));
    const orderedPreviewRecords = isLocalPreview
      ? previews.map(preview => savedByName.get(preview.name.toLocaleLowerCase()) || previewRecord(preview))
      : (!state.memories.length ? previews.map(previewRecord) : []);
    const previewNames = new Set(previews.map(preview => preview.name.toLocaleLowerCase()));
    const additionalSaved = isLocalPreview ? saved.filter(memory => !previewNames.has(memory.title.toLocaleLowerCase())) : saved;
    const suggested = state.suggestions.filter(item => item.kind === "memory" && !savedNames.has(String(item.title || "").toLocaleLowerCase())).map(item => ({
      id: item.id, title: item.title, notes: item.description || "", artworkKey: item.payload?.artworkKey || "summer-2026",
      collectionIds: item.payload?.collectionIds || [], suggestionId: item.id, suggested: true
    }));
    return [...orderedPreviewRecords, ...additionalSaved, ...suggested, { id: "new-memory", title: "ADD", notes: "", collectionIds: [], create: true }];
  }

  function memoryRecord(index = state.selectedMemory) {
    const raw = state.records[index] || state.records[0] || { id: "empty", title: "Your memories", collectionIds: [] };
    const collections = (raw.collectionIds || []).map(collectionById).filter(Boolean);
    const driveIds = new Set(collections.flatMap(collection => collection.driveIds || []));
    const drives = state.journeys.filter(drive => driveIds.has(drive.id));
    const photos = state.memoryPhotos.get(raw.id) || [];
    const inheritedHero = collections.map(collection => state.collectionHeroes.get(collection.id)).find(Boolean);
    return {
      ...raw, collections, photos, journeys: driveIds.size, miles: drives.reduce((sum, drive) => sum + (Number(drive.miles) || 0), 0),
      cover: photos[0]?.url || inheritedHero || memoryAsset(raw.artworkKey)
    };
  }

  function renderMemoryCards(preferredId) {
    const track = document.querySelector(".moments-memory-track");
    if (!track) return;
    const previous = state.records[state.selectedMemory]?.id;
    state.records = buildRecords();
    if (!state.records.length) return;
    const desired = preferredId || previous || "summer-2026";
    const desiredIndex = state.records.findIndex(record => record.id === desired || record.title === "Summer 2026");
    if (desiredIndex >= 0) state.selectedMemory = desiredIndex;
    state.selectedMemory = Math.min(state.selectedMemory, state.records.length - 1);
    track.innerHTML = state.records.map((record, index) => {
      if (record.create) return `<button class="moments-memory-card is-add" type="button" data-memory-index="${index}" aria-label="Create a new Memory"><span class="moments-memory-add-content"><span class="moments-memory-add-icon" aria-hidden="true">+</span><strong>ADD</strong></span></button>`;
      const memory = memoryRecord(index);
      const badge = record.suggested ? '<span class="moments-suggested-badge">SUGGESTED</span>' : "";
      const content = `<img src="${escape(memory.cover)}" alt="${escape(record.title)} cover" decoding="async"${index > 2 ? ' loading="lazy"' : ""}>${badge}<span class="moments-memory-copy"><strong>${escape(record.title)}</strong><small>${memory.collections.length} collections &middot; ${memory.journeys} journeys</small></span>`;
      if (record.suggested) return `<article class="moments-memory-card is-suggested" data-memory-index="${index}" aria-label="Suggested memory: ${escape(record.title)}">${content}<span class="moments-memory-suggestion-actions"><button type="button" data-confirm-memory-suggestion="${index}">Confirm</button><button type="button" data-dismiss-memory-suggestion="${index}">Dismiss</button></span></article>`;
      return `<button class="moments-memory-card" type="button" data-memory-index="${index}" aria-label="Select ${escape(record.title)}">${content}</button>`;
    }).join("");
    bindMemoryCards();
    createDots();
    selectMemory(state.selectedMemory, false);
    applyMemorySearch();
  }

  function createDots() {
    const cards = memoryCards(), dots = document.querySelector(".moments-carousel-dots");
    if (!dots) return;
    dots.innerHTML = cards.map((_, index) => `<button class="moments-carousel-dot" type="button" role="tab" data-memory-dot="${index}" aria-label="Show ${escape(state.records[index]?.title || "memory")}"></button>`).join("");
    dots.querySelectorAll("[data-memory-dot]").forEach(dot => dot.addEventListener("click", () => selectMemory(Number(dot.dataset.memoryDot))));
  }

  function selectMemory(index, announce = true) {
    const cards = memoryCards();
    if (!cards.length) return;
    state.selectedMemory = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
    cards.forEach((card, cardIndex) => {
      const rawOffset = cardIndex - state.selectedMemory, visible = rawOffset >= -2 && rawOffset <= 4, magnitude = Math.abs(rawOffset);
      card.style.setProperty("--moments-offset", String(Math.max(-3, Math.min(5, rawOffset))));
      card.style.setProperty("--moments-scale", String(rawOffset === 0 ? 1 : Math.max(.68, .9 - Math.max(0, magnitude - 1) * .08)));
      card.style.setProperty("--moments-y", rawOffset === 0 ? "0" : `${Math.min(46, 13 + magnitude * 8)}px`);
      card.style.setProperty("--moments-rotate-y", rawOffset === 0 ? "0deg" : `${rawOffset < 0 ? 7 : -7}deg`);
      card.style.setProperty("--moments-rotate-z", rawOffset === 0 ? "0deg" : `${rawOffset < 0 ? -.45 : .45}deg`);
      card.style.setProperty("--moments-opacity", String(visible ? Math.max(.35, 1 - magnitude * .13) : 0));
      card.style.setProperty("--moments-z", String(20 - magnitude));
      card.classList.toggle("is-selected", rawOffset === 0);
      card.toggleAttribute("aria-current", rawOffset === 0);
      card.setAttribute("aria-hidden", visible ? "false" : "true");
      card.tabIndex = rawOffset === 0 ? 0 : -1;
      card.querySelectorAll(".moments-memory-suggestion-actions button").forEach(button => { button.tabIndex = rawOffset === 0 ? 0 : -1; });
      card.style.pointerEvents = visible ? "auto" : "none";
    });
    document.querySelectorAll("[data-memory-dot]").forEach((dot, dotIndex) => { dot.classList.toggle("active", dotIndex === state.selectedMemory); dot.setAttribute("aria-selected", dotIndex === state.selectedMemory ? "true" : "false"); });
    const previous = document.querySelector(".moments-carousel-previous"), next = document.querySelector(".moments-carousel-next");
    if (previous) previous.disabled = state.selectedMemory === 0;
    if (next) next.disabled = state.selectedMemory === cards.length - 1;
    const title = state.records[state.selectedMemory]?.title || "Memory";
    document.querySelectorAll("[data-selected-memory]").forEach(label => { label.textContent = title.toLocaleUpperCase(); });
    renderSelectedCollections();
    void hydrateSelectedHeroes();
    if (announce) showStatus(`${title} selected`);
  }

  function renderSelectedCollections() {
    const grid = document.querySelector(".moments-collection-grid");
    if (!grid) return;
    const memory = memoryRecord();
    const collectionSuggestions = state.suggestions.filter(item => item.kind === "collection").slice(0, 1);
    const items = [...memory.collections.map((collection, index) => ({ collection, index })), ...collectionSuggestions.map((suggestion, index) => ({ suggestion, index: memory.collections.length + index }))];
    grid.innerHTML = items.length ? items.map(item => {
      if (item.suggestion) {
        const count = item.suggestion.payload?.driveIds?.length || 0;
        return `<button class="moments-collection-card is-suggested" type="button" data-suggested-collection="${escape(item.suggestion.id)}"><img src="${collectionAsset({ name: item.suggestion.title }, item.index)}" alt="" loading="lazy"><b>SUGGESTED</b><span><strong>${escape(item.suggestion.title)}</strong><small>${count} journeys</small></span>${collectionChevron}</button>`;
      }
      const hero = state.collectionHeroes.get(item.collection.id) || collectionAsset(item.collection, item.index);
      return `<button class="moments-collection-card" type="button" data-collection-id="${escape(item.collection.id)}"><img src="${escape(hero)}" alt="${escape(item.collection.name)} cover" loading="lazy"><span><strong>${escape(item.collection.name)}</strong><small>${collectionJourneyCount(item.collection)} journeys</small></span>${collectionChevron}</button>`;
    }).join("") : '<div class="moments-collections-empty"><strong>No collections in this memory yet</strong><span>Edit the memory and choose at least two saved collections.</span></div>';
    grid.querySelectorAll("[data-collection-id]").forEach(card => card.addEventListener("click", () => document.dispatchEvent(new CustomEvent("journeydeck:opencollection", { detail: { collectionId: card.dataset.collectionId } }))));
    grid.querySelectorAll("[data-suggested-collection]").forEach(card => card.addEventListener("click", () => {
      const suggestion = state.suggestions.find(item => item.id === card.dataset.suggestedCollection);
      document.dispatchEvent(new CustomEvent("journeydeck:opencollection", { detail: { collectionName: suggestion?.title || "", description: suggestion?.description || "A suggested collection based on your journeys.", driveIds: suggestion?.payload?.driveIds || [], suggested: true } }));
    }));
    applyCollectionSearch();
  }

  async function collectionHero(collectionId, force = false) {
    if (!collectionId) return null;
    if (force) { state.collectionHeroes.delete(collectionId); state.collectionHeroPromises.delete(collectionId); }
    if (state.collectionHeroes.has(collectionId)) return state.collectionHeroes.get(collectionId);
    if (state.collectionHeroPromises.has(collectionId)) return state.collectionHeroPromises.get(collectionId);
    const promise = (async () => {
      try {
        const listed = await api.post("/api/collections/attachments/list", { collectionId });
        const image = (listed.attachments || []).find(item => String(item.contentType || "").startsWith("image/"));
        if (!image) return null;
        const record = await api.post("/api/collections/attachments/get", { attachmentId: image.id });
        return `data:${record.contentType};base64,${record.dataBase64}`;
      } catch { return null; }
    })();
    state.collectionHeroPromises.set(collectionId, promise);
    const value = await promise;
    state.collectionHeroPromises.delete(collectionId);
    state.collectionHeroes.set(collectionId, value);
    return value;
  }

  async function hydrateSelectedHeroes() {
    const memory = memoryRecord();
    await Promise.allSettled(memory.collections.map(collection => collectionHero(collection.id)));
    const card = memoryCards()[state.selectedMemory];
    if (card) card.querySelector("img").src = memoryRecord().cover;
    renderSelectedCollections();
  }

  async function loadMemoryPhotos(memoryId, force = false) {
    if (!memoryId?.startsWith("memory_")) return [];
    if (!force && state.memoryPhotos.has(memoryId)) return state.memoryPhotos.get(memoryId);
    try {
      const listed = await api.post("/api/memories/attachments/list", { memoryId });
      const photos = (await Promise.all((listed.attachments || []).slice(0, 12).map(async item => {
        const record = await api.post("/api/memories/attachments/get", { attachmentId: item.id });
        return { ...item, url: `data:${record.contentType};base64,${record.dataBase64}` };
      }))).filter(Boolean);
      state.memoryPhotos.set(memoryId, photos);
      return photos;
    } catch { state.memoryPhotos.set(memoryId, []); return []; }
  }

  function renderMemoryCollections(collections, target) {
    if (!target) return;
    target.innerHTML = collections.map(collection => `<button class="memory-details-collection" type="button" data-memory-collection-id="${escape(collection.id)}"><span><strong>${escape(collection.name)}</strong><small>${collectionJourneyCount(collection)} journeys</small></span>${collectionChevron}</button>`).join("");
    target.querySelectorAll("[data-memory-collection-id]").forEach(button => button.addEventListener("click", () => {
      closeMemoryModal();
      document.dispatchEvent(new CustomEvent("journeydeck:opencollection", { detail: { collectionId: button.dataset.memoryCollectionId } }));
    }));
  }

  function renderMemoryDetails() {
    const memory = memoryRecord(state.activeMemoryIndex);
    const cover = document.getElementById("memoryDetailsCover");
    if (cover) { cover.src = memory.cover; cover.alt = `${memory.title} cover`; }
    const values = {
      memoryDetailsHeading: memory.title, memoryDetailsSummary: `${memory.collections.length} collections \u00b7 ${memory.journeys} journeys`,
      memoryDetailsMiles: `${Number(memory.miles).toLocaleString(undefined, { maximumFractionDigits: 1 })} mi`, memoryDetailsJourneyCount: String(memory.journeys),
      memoryDetailsCollectionCount: String(memory.collections.length), memoryDetailsPhotoCount: String(memory.photos.length),
      memoryDetailsNotes: memory.notes || "No notes yet.", memoryDetailsCollectionLabel: `${memory.collections.length} total`
    };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
    const photos = document.getElementById("memoryDetailsPhotos");
    if (photos) photos.innerHTML = memory.photos.length ? memory.photos.map(photo => `<figure><img src="${escape(photo.url)}" alt="${escape(photo.fileName || photo.name || "Memory photo")}"><figcaption>${escape(photo.fileName || photo.name || "Photo")}</figcaption></figure>`).join("") : '<div class="memory-details-empty"><span aria-hidden="true">\u25A7</span><p>Add personal pictures while editing this memory.</p></div>';
    renderMemoryCollections(memory.collections, document.getElementById("memoryDetailsCollections"));
  }

  async function openMemoryModal(index) {
    state.activeMemoryIndex = index;
    renderMemoryDetails();
    document.getElementById("memoryEditForm")?.setAttribute("hidden", "");
    document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
    const modal = document.getElementById("memoryDetailsModal");
    if (!modal) return;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    modal.querySelector("[data-close-memory-modal]")?.focus();
    const memory = memoryRecord(index);
    await Promise.allSettled([loadMemoryPhotos(memory.id), ...memory.collections.map(collection => collectionHero(collection.id))]);
    renderMemoryDetails();
  }

  async function confirmMemorySuggestion(index) {
    const record = state.records[index]; if (!record?.suggested) return;
    selectMemory(index, false);
    await openMemoryModal(index);
    showMemoryEditor();
    showStatus("Review the suggested Memory, then save when it looks right.");
  }

  async function dismissMemorySuggestion(index, button) {
    const record = state.records[index]; if (!record?.suggestionId) return;
    if (button) button.disabled = true;
    try {
      await api.post("/api/memories/suggestions/status", { suggestionId: record.suggestionId, status: "dismissed" });
      state.suggestions = state.suggestions.filter(item => item.id !== record.suggestionId);
      const fallbackId = state.records[Math.max(0, index - 1)]?.id;
      renderMemoryCards(fallbackId);
      showStatus("Suggestion dismissed. JourneyDeck will not suggest that grouping again for 30 days.");
    } catch (error) { showStatus(error.message); if (button) button.disabled = false; }
  }

  function closeMemoryModal() {
    discardMemoryEdits();
    const modal = document.getElementById("memoryDetailsModal");
    if (!modal) return;
    if (modal.contains(document.activeElement)) document.activeElement.blur();
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    document.getElementById("memoryEditForm")?.setAttribute("hidden", "");
    document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
    memoryCards()[state.selectedMemory]?.focus({ preventScroll: true });
  }

  function discardMemoryEdits() {
    state.editPhotos.filter(photo => photo.temporary).forEach(photo => URL.revokeObjectURL(photo.url));
    state.editCollections = []; state.editPhotos = [];
    const results = document.getElementById("memoryEditCollectionResults");
    if (results) results.hidden = true;
  }

  function renderMemoryEditCollections() {
    const target = document.getElementById("memoryEditCollections");
    if (!target) return;
    target.innerHTML = state.editCollections.map(collection => `<div><span><strong>${escape(collection.name)}</strong><small>${collectionJourneyCount(collection)} journeys</small></span><div class="memory-edit-collection-actions"><button class="memory-edit-collection-view" type="button" data-view-memory-collection="${escape(collection.id)}" aria-label="View ${escape(collection.name)} overview">View</button><button class="memory-edit-collection-remove" type="button" data-remove-memory-collection="${escape(collection.id)}" aria-label="Remove ${escape(collection.name)} from this memory">Remove</button></div></div>`).join("");
    target.querySelectorAll("[data-view-memory-collection]").forEach(button => button.addEventListener("click", () => document.dispatchEvent(new CustomEvent("journeydeck:opencollection", { detail: { collectionId: button.dataset.viewMemoryCollection } }))));
    target.querySelectorAll("[data-remove-memory-collection]").forEach(button => button.addEventListener("click", () => { state.editCollections = state.editCollections.filter(collection => collection.id !== button.dataset.removeMemoryCollection); renderMemoryEditCollections(); renderCollectionSearch(); }));
  }

  function renderMemoryEditPhotos() {
    const target = document.getElementById("memoryEditPhotos");
    if (!target) return;
    target.innerHTML = state.editPhotos.length ? state.editPhotos.map((photo, index) => `<figure><img src="${escape(photo.url)}" alt="${escape(photo.fileName || photo.name || "Photo")}"><button type="button" data-remove-memory-photo="${index}" aria-label="Remove photo">\u00d7</button><figcaption>${escape(photo.fileName || photo.name || "Photo")}</figcaption></figure>`).join("") : '<p class="memory-edit-help">No personal pictures added yet.</p>';
    target.querySelectorAll("[data-remove-memory-photo]").forEach(button => button.addEventListener("click", () => { const [removed] = state.editPhotos.splice(Number(button.dataset.removeMemoryPhoto), 1); if (removed?.temporary) URL.revokeObjectURL(removed.url); renderMemoryEditPhotos(); }));
  }

  function renderCollectionSearch() {
    const input = document.getElementById("memoryEditCollectionInput"), results = document.getElementById("memoryEditCollectionResults");
    if (!input || !results) return;
    const query = input.value.trim().toLocaleLowerCase(), selected = new Set(state.editCollections.map(collection => collection.id));
    const matches = state.collections.filter(collection => !selected.has(collection.id) && (!query || String(collection.name || "").toLocaleLowerCase().includes(query))).slice(0, 8);
    results.innerHTML = matches.map(collection => `<button type="button" role="option" data-choose-memory-collection="${escape(collection.id)}"><strong>${escape(collection.name)}</strong><span>${collectionJourneyCount(collection)} journeys</span></button>`).join("");
    results.hidden = !matches.length;
    results.querySelectorAll("[data-choose-memory-collection]").forEach(button => button.addEventListener("click", () => addMemoryCollection(button.dataset.chooseMemoryCollection)));
  }

  async function refreshMemoryCollectionSearch() {
    const message = document.getElementById("memoryEditMessage"), selectedIds = state.editCollections.map(collection => collection.id);
    try {
      const data = await api.get("/api/collections");
      state.collections = Array.isArray(data.collections) ? data.collections : [];
      state.editCollections = selectedIds.map(collectionById).filter(Boolean);
      renderMemoryEditCollections(); renderCollectionSearch();
    } catch (error) { if (message) message.textContent = `Saved collections could not refresh: ${error.message}`; }
  }

  function addMemoryCollection(collectionId) {
    const input = document.getElementById("memoryEditCollectionInput"), query = input?.value.trim().toLocaleLowerCase() || "";
    let collection = collectionId ? collectionById(collectionId) : state.collections.find(item => !state.editCollections.some(selected => selected.id === item.id) && String(item.name || "").toLocaleLowerCase() === query);
    if (!collection) {
      const matches = state.collections.filter(item => !state.editCollections.some(selected => selected.id === item.id) && String(item.name || "").toLocaleLowerCase().includes(query));
      if (matches.length === 1) collection = matches[0];
    }
    const message = document.getElementById("memoryEditMessage");
    if (!collection) { if (message) message.textContent = "Choose one of the matching saved collections."; renderCollectionSearch(); return; }
    if (state.editCollections.some(item => item.id === collection.id)) { if (message) message.textContent = "That collection is already in this memory."; return; }
    state.editCollections.push(collection);
    if (input) input.value = "";
    if (message) message.textContent = "";
    renderMemoryEditCollections(); renderCollectionSearch();
  }

  function showMemoryEditor() {
    const memory = memoryRecord(state.activeMemoryIndex);
    state.editCollections = memory.collections.map(collection => ({ ...collection }));
    state.editPhotos = memory.photos.map(photo => ({ ...photo }));
    document.getElementById("memoryDetailsView")?.setAttribute("hidden", "");
    document.getElementById("memoryEditForm")?.removeAttribute("hidden");
    const title = document.getElementById("memoryEditTitle"), notes = document.getElementById("memoryEditNotes"), input = document.getElementById("memoryEditCollectionInput");
    if (title) title.value = memory.create ? "" : memory.title;
    if (notes) notes.value = memory.notes || "";
    if (input) input.value = "";
    const message = document.getElementById("memoryEditMessage"); if (message) message.textContent = "";
    renderMemoryEditCollections(); renderMemoryEditPhotos(); renderCollectionSearch(); void refreshMemoryCollectionSearch(); title?.focus();
  }

  const bytesToBase64 = bytes => { let value = ""; for (let index = 0; index < bytes.length; index += 32768) value += String.fromCharCode(...bytes.subarray(index, index + 32768)); return btoa(value); };
  async function prepareImage(file) {
    const bitmap = await createImageBitmap(file), scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    let quality = .84, blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    while (blob && blob.size > MAX_IMAGE_BYTES && quality > .5) { quality -= .08; blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality)); }
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} could not be optimized below 1.5 MB.`);
    return { fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg", contentType: "image/jpeg", dataBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
  }

  async function saveMemory(event) {
    event.preventDefault();
    const form = event.currentTarget, submit = form.querySelector('[type="submit"]'), current = memoryRecord(state.activeMemoryIndex), title = document.getElementById("memoryEditTitle")?.value.trim(), message = document.getElementById("memoryEditMessage");
    if (!title) return;
    if (state.editCollections.length < 2) { if (message) message.textContent = "A memory needs at least two saved collections."; return; }
    submit.disabled = true; if (message) message.textContent = "Saving memory\u2026";
    try {
      const saved = await api.post("/api/memories/save", {
        id: current.saved ? current.id : null, name: title, notes: document.getElementById("memoryEditNotes")?.value.trim() || "",
        artworkKey: current.artworkKey || "summer-2026", collectionIds: state.editCollections.map(collection => collection.id), suggestionId: current.suggestionId || null
      });
      const retained = new Set(state.editPhotos.filter(photo => photo.id).map(photo => photo.id));
      for (const photo of current.photos.filter(photo => photo.id && !retained.has(photo.id))) await api.post("/api/memories/attachments/remove", { attachmentId: photo.id });
      for (const photo of state.editPhotos.filter(item => item.temporary && item.file)) await api.post("/api/memories/attachments/add", { memoryId: saved.id, ...(await prepareImage(photo.file)) });
      state.editPhotos.filter(photo => photo.temporary).forEach(photo => URL.revokeObjectURL(photo.url));
      state.memoryPhotos.delete(saved.id);
      await loadData(saved.id);
      state.activeMemoryIndex = Math.max(0, state.records.findIndex(record => record.id === saved.id));
      await loadMemoryPhotos(saved.id, true);
      renderMemoryDetails();
      form.setAttribute("hidden", ""); document.getElementById("memoryDetailsView")?.removeAttribute("hidden");
      showStatus(`${saved.name} saved`);
    } catch (error) { if (message) message.textContent = error.message; }
    finally { submit.disabled = false; }
  }

  function normalizedJourney(drive) {
    const start = String(drive.startingLocation || drive.rawStartingLocation || "").trim(), end = String(drive.endingLocation || drive.rawEndingLocation || "").trim();
    const songCount = Array.isArray(drive.soundtrack) ? drive.soundtrack.filter(Boolean).length : Number(drive.songCount) || 0;
    return { id: drive.id || "", startedAt: drive.startedAt || drive.dateIso || drive.dateNumeric || "", route: String(drive.route || `${start || "Start"} \u2192 ${end || "Destination"}`).trim(), miles: Number(drive.miles) || 0, durationMinutes: Number(drive.durationMinutes) || 0, songCount, source: drive };
  }
  function dateParts(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? { date: "Recent", time: "" } : { date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }; }
  function collectionPickerModal() { return document.getElementById("momentsCollectionPickerModal"); }
  function setCollectionPickerStep(step) {
    const modal = collectionPickerModal(), choice = document.getElementById("momentsCollectionPickerChoice"), search = document.getElementById("momentsCollectionPickerSearch"), create = document.getElementById("momentsCollectionCreate");
    if (!modal || !choice || !search || !create) return;
    const searching = step === "search";
    const creating = step === "create";
    choice.hidden = searching || creating; search.hidden = !searching; create.hidden = !creating;
    modal.classList.toggle("is-create-step", creating);
    modal.setAttribute("aria-labelledby", creating ? "momentsCollectionCreateHeading" : searching ? "momentsCollectionPickerSearchHeading" : "momentsCollectionPickerHeading");
    document.getElementById("momentsCollectionPickerChoiceMessage").textContent = "";
    document.getElementById("momentsCollectionPickerSearchMessage").textContent = "";
    document.getElementById("momentsCreateMessage").textContent = "";
    if (searching) {
      const input = document.getElementById("momentsCollectionPickerSearchInput");
      input.value = ""; renderCollectionPickerResults(""); window.setTimeout(() => input.focus(), 0);
    } else if (creating) window.setTimeout(() => document.getElementById("momentsCreateName")?.focus(), 0);
    else window.setTimeout(() => document.querySelector("[data-moments-picker-create]")?.focus(), 0);
  }
  function openCollectionPicker(driveId) {
    const modal = collectionPickerModal(); if (!modal) return;
    state.pickerJourneyId = driveId || null;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    setCollectionPickerStep("choice");
  }
  function closeCollectionPicker() {
    const modal = collectionPickerModal(); if (!modal) return;
    modal.classList.remove("open", "is-create-step"); modal.setAttribute("aria-hidden", "true"); state.pickerJourneyId = null;
    state.pickerCreatePhotos.filter(photo => photo.temporary).forEach(photo => URL.revokeObjectURL(photo.url));
    state.pickerCreatePhotos = []; state.pickerSelectedJourneyIds = new Set();
  }
  function collectionPickerRecord(collection, index) {
    const driveIds = new Set((collection.driveIds || []).map(String));
    const journeys = state.journeys.filter(journey => driveIds.has(String(journey.id)));
    const dates = journeys.map(journey => new Date(journey.startedAt)).filter(date => !Number.isNaN(date.getTime())).sort((a, b) => a - b);
    const dateLabel = date => date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const dateRange = dates.length > 1 ? `${dateLabel(dates[0])} \u2013 ${dateLabel(dates[dates.length - 1])}` : dates.length ? dateLabel(dates[0]) : "No journey dates yet";
    const miles = journeys.reduce((sum, journey) => sum + (Number(journey.miles) || 0), 0);
    const songs = journeys.reduce((sum, journey) => sum + (Number(journey.songCount) || 0), 0);
    return { collection, dateRange, miles: formatJourneyMiles(miles), songs: `${songs} song${songs === 1 ? "" : "s"}`, image: state.collectionHeroes.get(collection.id) || collectionAsset(collection, index) };
  }
  function renderCollectionPickerResults(query = "") {
    const results = document.getElementById("momentsCollectionPickerResults"), count = document.getElementById("momentsCollectionPickerCount"); if (!results || !count) return;
    const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = state.collections.filter(collection => terms.every(term => `${collection.name} ${collection.description || ""}`.toLocaleLowerCase().includes(term))).map(collectionPickerRecord);
    count.textContent = `${matches.length} collection${matches.length === 1 ? "" : "s"} found`;
    results.innerHTML = matches.length ? matches.map((item, index) => { const alreadyAdded = (item.collection.driveIds || []).map(String).includes(String(state.pickerJourneyId)); return `<div class="moments-picker-result${index === 0 ? " is-active" : ""}" role="option" aria-selected="${index === 0}" data-picker-result="${escape(item.collection.id)}">
      <img src="${escape(item.image)}" alt="" loading="lazy"><span class="moments-picker-result-copy"><strong>${escape(item.collection.name)}</strong><small>${escape(item.dateRange)}</small></span>
      <span class="moments-picker-result-stat"><i aria-hidden="true">\u2301</i>${escape(item.miles)}</span><span class="moments-picker-result-stat"><i aria-hidden="true">\u266B</i>${escape(item.songs)}</span>
      <button type="button" data-add-existing-collection="${escape(item.collection.id)}"${alreadyAdded ? " disabled" : ""}>${alreadyAdded ? "\u2713 Added" : '<span aria-hidden="true">+</span> Add'}</button></div>`; }).join("") : '<div class="moments-picker-no-results"><strong>No collections found</strong><span>Try another collection name.</span></div>';
  }
  async function addJourneyToExistingCollection(collectionId, button) {
    const collection = collectionById(collectionId); if (!collection) return;
    const journey = state.journeys.find(item => String(item.id) === String(state.pickerJourneyId));
    const message = document.getElementById("momentsCollectionPickerSearchMessage");
    if (!journey?.id) { message.textContent = "JourneyDeck could not identify this journey."; return; }
    const driveIds = Array.from(new Set([...(collection.driveIds || []).map(String), String(journey.id)]));
    if (button) button.disabled = true;
    message.textContent = `Adding ${journey.route || "this journey"} to ${collection.name}\u2026`;
    try {
      const saved = await api.post("/api/collections/save", { id: collection.id, name: collection.name, description: collection.description || "", driveIds });
      state.collections = [saved, ...state.collections.filter(item => String(item.id) !== String(saved.id))];
      document.dispatchEvent(new CustomEvent("journeydeck:collectionchanged", { detail: { collectionId: saved.id, source: "moments-existing" } }));
      closeCollectionPicker();
      showStatus(`${journey.route || "Journey"} added to ${saved.name}`);
    } catch (error) { message.textContent = error.message || "JourneyDeck could not update this collection."; if (button) button.disabled = false; }
  }
  const journeyArtwork = index => `/assets/moments/${fallbackCollectionFiles[index % fallbackCollectionFiles.length]}?v=2`;
  function createJourneyRecord(id) { return state.journeys.find(journey => String(journey.id) === String(id)); }
  function formatJourneyMiles(value) { return `${(Math.round((Number(value) || 0) * 10) / 10).toFixed(1).replace(/\.0$/, "")} mi`; }
  function renderCreatePhotos() {
    const container = document.getElementById("momentsCreatePhotos"); if (!container) return;
    container.innerHTML = state.pickerCreatePhotos.map((photo, index) => `<figure><img src="${escape(photo.url)}" alt="Collection photo ${index + 1}"><button type="button" data-remove-create-photo="${escape(photo.id)}" aria-label="Remove ${escape(photo.name)}">\u00d7</button></figure>`).join("");
  }
  function renderCreateJourneyLists(query = document.getElementById("momentsCreateJourneySearch")?.value || "") {
    const available = document.getElementById("momentsCreateAvailableJourneys"), selected = document.getElementById("momentsCreateSelectedJourneys"); if (!available || !selected) return;
    const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const selectedJourneys = state.journeys.filter(journey => state.pickerSelectedJourneyIds.has(String(journey.id)));
    const availableJourneys = state.journeys.filter(journey => !state.pickerSelectedJourneyIds.has(String(journey.id)) && terms.every(term => `${journey.route} ${dateParts(journey.startedAt).date}`.toLocaleLowerCase().includes(term)));
    const row = (journey, index, action) => { const parts = dateParts(journey.startedAt); return `<article class="moments-create-journey" role="listitem"><img src="${journeyArtwork(index)}" alt=""><span class="moments-create-journey-copy"><strong>${escape(journey.route)}</strong><small>${escape(parts.date)}</small></span><span>${escape(formatJourneyMiles(journey.miles))}</span><span>\u266b ${escape(journey.songCount || 0)} songs</span><button type="button" data-${action}-create-journey="${escape(journey.id)}">${action === "add" ? "+ Add" : "Remove"}</button></article>`; };
    available.innerHTML = availableJourneys.length ? availableJourneys.slice(0, 20).map((journey, index) => row(journey, index, "add")).join("") : '<div class="moments-create-empty">No matching journeys available.</div>';
    selected.innerHTML = selectedJourneys.length ? selectedJourneys.map((journey, index) => row(journey, index + 1, "remove")).join("") : '<div class="moments-create-empty">Add at least one journey to begin.</div>';
    document.getElementById("momentsCreateAvailableCount").textContent = `${availableJourneys.length} result${availableJourneys.length === 1 ? "" : "s"}`;
    document.getElementById("momentsCreateSelectedCount").textContent = `${selectedJourneys.length} selected`;
    const miles = selectedJourneys.reduce((sum, journey) => sum + (Number(journey.miles) || 0), 0), songs = selectedJourneys.reduce((sum, journey) => sum + (Number(journey.songCount) || 0), 0);
    document.getElementById("momentsCreateJourneyCount").textContent = selectedJourneys.length;
    document.getElementById("momentsCreateJourneyCount").nextElementSibling.textContent = selectedJourneys.length === 1 ? "journey" : "journeys";
    document.getElementById("momentsCreateMiles").textContent = formatJourneyMiles(miles);
    document.getElementById("momentsCreateSongs").textContent = songs;
  }
  function openCreateCollection() {
    state.pickerSelectedJourneyIds = new Set(state.pickerJourneyId ? [String(state.pickerJourneyId)] : []);
    state.pickerCreatePhotos = [];
    document.getElementById("momentsCreateName").value = "";
    document.getElementById("momentsCreateNotes").value = "";
    document.getElementById("momentsCreateJourneySearch").value = "";
    renderCreatePhotos(); renderCreateJourneyLists(""); setCollectionPickerStep("create");
  }
  function openNewCollection() {
    openCollectionPicker(null);
    openCreateCollection();
  }
  function addCreatePhotos(event) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    for (const file of files) { if (state.pickerCreatePhotos.length >= 6) break; if (!file.type.startsWith("image/")) continue; state.pickerCreatePhotos.push({ id: `preview-upload-${Date.now()}-${state.pickerCreatePhotos.length}`, name: file.name, file, url: URL.createObjectURL(file), temporary: true }); }
    renderCreatePhotos();
  }
  async function saveCreatedCollection(event) {
    event.preventDefault();
    const form = event.currentTarget, submit = form.querySelector('[type="submit"]'), message = document.getElementById("momentsCreateMessage"), name = document.getElementById("momentsCreateName").value.trim();
    if (!name) { message.textContent = "Give this collection a name."; document.getElementById("momentsCreateName").focus(); return; }
    if (!state.pickerSelectedJourneyIds.size) { message.textContent = "Add at least one journey before creating the collection."; return; }
    submit.disabled = true; message.textContent = "Saving collection\u2026";
    try {
      const saved = await api.post("/api/collections/save", {
        name, description: document.getElementById("momentsCreateNotes").value.trim(), driveIds: Array.from(state.pickerSelectedJourneyIds)
      });
      let photoError = null;
      for (const photo of state.pickerCreatePhotos.filter(item => item.temporary && item.file)) {
        try { await api.post("/api/collections/attachments/add", { collectionId: saved.id, ...(await prepareImage(photo.file)) }); }
        catch (error) { photoError ||= error; }
      }
      state.collections = [saved, ...state.collections.filter(collection => collection.id !== saved.id)];
      state.collectionHeroes.delete(saved.id); state.collectionHeroPromises.delete(saved.id);
      document.dispatchEvent(new CustomEvent("journeydeck:collectionchanged", { detail: { collectionId: saved.id, source: "moments-create" } }));
      closeCollectionPicker();
      showStatus(photoError ? `${saved.name} saved, but one or more photos could not be uploaded.` : `${saved.name} collection created`);
    } catch (error) { message.textContent = error.message || "JourneyDeck could not save this collection."; }
    finally { submit.disabled = false; }
  }
  function renderJourneys(drives = state.journeys) {
    const rows = document.getElementById("momentsJourneyRows"); if (!rows) return;
    const refreshMemories = drives !== state.journeys;
    const normalized = (Array.isArray(drives) && drives.length ? drives : demoJourneys).map(normalizedJourney).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))).slice(0, 100);
    state.journeys = normalized.length ? normalized : demoJourneys;
    const query = state.searchQueries.journeys;
    const ranked = state.journeys.map((journey, index) => ({ journey, index, match: searchMatches(`${journey.route} ${dateParts(journey.startedAt).date} ${journey.miles} mi ${journey.durationMinutes} min`, query) })).sort((a, b) => query ? Number(b.match) - Number(a.match) || a.index - b.index : a.index - b.index);
    const visibleRecords = query ? ranked : (state.expandedJourneys ? ranked : ranked.slice(0, 4));
    const visible = visibleRecords.map(item => item.journey);
    rows.innerHTML = visibleRecords.map(({ journey, match }) => { const parts = dateParts(journey.startedAt), miles = Number(journey.miles).toFixed(1).replace(/\.0$/, ""), filterClass = query ? (match ? " is-filter-match" : " is-filter-dimmed") : ""; return `<div class="moments-journey-row${filterClass}" role="row" tabindex="0" data-moments-open-journey="${escape(journey.id)}"><span class="moments-journey-date" role="cell">${escape(parts.date)} &nbsp; ${escape(parts.time)}</span><span class="moments-journey-route" role="cell">${escape(journey.route)}</span><span class="moments-journey-distance" role="cell">${escape(miles)} mi</span><span class="moments-journey-duration" role="cell">${escape(journey.durationMinutes)} min</span><button class="moments-journey-add" type="button" data-moments-add-journey="${escape(journey.id)}">+ &nbsp; Add to collection</button></div>`; }).join("");
    rows.querySelectorAll("[data-moments-add-journey]").forEach(button => button.addEventListener("click", event => { event.stopPropagation(); openCollectionPicker(button.dataset.momentsAddJourney || null); }));
    rows.querySelectorAll("[data-moments-open-journey]").forEach((row, rowIndex) => { const open = () => { const journey = visible[rowIndex]; document.dispatchEvent(new CustomEvent("journeydeck:openjourney", { detail: { driveId: journey.id || null, drive: journey.source || journey } })); }; row.addEventListener("click", open); row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }); });
    const viewAll = document.querySelector("[data-moments-view-all]"); if (viewAll) viewAll.textContent = state.expandedJourneys ? "Show newest four \u2191" : "View all journeys \u2192";
    updateSearchCount("journeys", ranked.filter(item => item.match).length, ranked.length);
    if (refreshMemories && state.records.length) { const selectedId = state.records[state.selectedMemory]?.id; renderMemoryCards(selectedId); }
  }

  async function loadData(preferredId) {
    try {
      const jobs = [api.get("/api/memories")];
      if (!state.collections.length) jobs.push(api.get("/api/collections"));
      const [memoryData, collectionData] = await Promise.all(jobs);
      state.memories = Array.isArray(memoryData.memories) ? memoryData.memories : [];
      state.suggestions = Array.isArray(memoryData.suggestions) ? memoryData.suggestions : [];
      if (collectionData) state.collections = Array.isArray(collectionData.collections) ? collectionData.collections : [];
      renderMemoryCards(preferredId);
    } catch (error) { showStatus(error.message); renderMemoryCards(preferredId); }
  }
  function setJourneys(drives) { if (Array.isArray(drives) && drives.length) renderJourneys(drives); }
  function setCollections(collections) { if (Array.isArray(collections)) { state.collections = collections; void loadData(state.records[state.selectedMemory]?.id); } }

  function bindMemoryCards() {
    // Cards are replaced whenever durable data changes. Their click behavior is
    // delegated from the document so an in-flight refresh cannot orphan it.
  }
  function bindActions() {
    document.querySelector(".moments-carousel-previous")?.addEventListener("click", () => selectMemory(state.selectedMemory - 1));
    document.querySelector(".moments-carousel-next")?.addEventListener("click", () => selectMemory(state.selectedMemory + 1));
    const carousel = document.querySelector(".moments-memory-carousel");
    carousel?.addEventListener("keydown", event => { if (event.key === "ArrowLeft") { event.preventDefault(); selectMemory(state.selectedMemory - 1); } if (event.key === "ArrowRight") { event.preventDefault(); selectMemory(state.selectedMemory + 1); } });
    carousel?.addEventListener("pointerdown", event => { if (event.pointerType !== "mouse") state.pointerStartX = event.clientX; }, { passive: true });
    carousel?.addEventListener("pointerup", event => { if (state.pointerStartX == null) return; const distance = event.clientX - state.pointerStartX; state.pointerStartX = null; if (Math.abs(distance) >= 42) selectMemory(state.selectedMemory + (distance < 0 ? 1 : -1)); }, { passive: true });
    document.addEventListener("click", event => {
      if (event.target.closest("[data-moments-new-collection]")) { event.preventDefault(); event.stopPropagation(); openNewCollection(); return; }
      const confirmSuggestion = event.target.closest("[data-confirm-memory-suggestion]");
      if (confirmSuggestion) { event.preventDefault(); event.stopPropagation(); void confirmMemorySuggestion(Number(confirmSuggestion.dataset.confirmMemorySuggestion)); return; }
      const dismissSuggestion = event.target.closest("[data-dismiss-memory-suggestion]");
      if (dismissSuggestion) { event.preventDefault(); event.stopPropagation(); void dismissMemorySuggestion(Number(dismissSuggestion.dataset.dismissMemorySuggestion), dismissSuggestion); return; }
      if (event.target.closest("#memoryEditButton")) {
        event.preventDefault();
        event.stopPropagation();
        showMemoryEditor();
        return;
      }
      if (event.target.closest("[data-close-memory-modal]")) { event.preventDefault(); event.stopPropagation(); closeMemoryModal(); }
      const memoryCard = event.target.closest(".moments-memory-card");
      if (memoryCard) {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(memoryCard.dataset.memoryIndex);
        const wasSelected = index === state.selectedMemory;
        selectMemory(index);
        if (!wasSelected && !state.records[index]?.create) return;
        if (state.records[index]?.create) { state.activeMemoryIndex = index; void openMemoryModal(index).then(showMemoryEditor); return; }
        if (!state.records[index]?.suggested) void openMemoryModal(index);
      }
    }, true);
    document.getElementById("memoryEditCancel")?.addEventListener("click", () => { discardMemoryEdits(); document.getElementById("memoryEditForm")?.setAttribute("hidden", ""); document.getElementById("memoryDetailsView")?.removeAttribute("hidden"); });
    document.getElementById("memoryEditAddCollection")?.addEventListener("click", () => addMemoryCollection());
    document.getElementById("memoryEditCollectionInput")?.addEventListener("input", renderCollectionSearch);
    document.getElementById("memoryEditCollectionInput")?.addEventListener("focus", renderCollectionSearch);
    document.getElementById("memoryEditCollectionInput")?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addMemoryCollection(); } });
    document.getElementById("memoryEditPhotoInput")?.addEventListener("change", event => { const message = document.getElementById("memoryEditMessage"); for (const file of Array.from(event.target.files || [])) { if (state.editPhotos.length >= 6) { if (message) message.textContent = "A memory can hold up to 6 photos."; break; } if (!file.type.startsWith("image/")) continue; state.editPhotos.push({ name: file.name, file, url: URL.createObjectURL(file), temporary: true }); } event.target.value = ""; renderMemoryEditPhotos(); });
    document.getElementById("memoryEditForm")?.addEventListener("submit", saveMemory);
    document.querySelectorAll("[data-close-moments-collection-picker]").forEach(element => element.addEventListener("click", closeCollectionPicker));
    document.querySelector("[data-moments-picker-existing]")?.addEventListener("click", () => setCollectionPickerStep("search"));
    document.querySelector("[data-moments-picker-back]")?.addEventListener("click", () => setCollectionPickerStep("choice"));
    document.querySelector("[data-moments-picker-create]")?.addEventListener("click", openCreateCollection);
    document.getElementById("momentsCollectionPickerSearchInput")?.addEventListener("input", event => renderCollectionPickerResults(event.currentTarget.value));
    document.getElementById("momentsCollectionPickerSearchInput")?.addEventListener("keydown", event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
      const results = Array.from(document.querySelectorAll("#momentsCollectionPickerResults .moments-picker-result")); if (!results.length) return;
      event.preventDefault();
      const current = Math.max(0, results.findIndex(result => result.classList.contains("is-active")));
      if (event.key === "Enter") { results[current].querySelector("[data-add-existing-collection]")?.click(); return; }
      const next = (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      results.forEach((result, index) => { result.classList.toggle("is-active", index === next); result.setAttribute("aria-selected", String(index === next)); });
      results[next].scrollIntoView({ block: "nearest" });
    });
    document.querySelector("[data-moments-picker-clear]")?.addEventListener("click", () => { const input = document.getElementById("momentsCollectionPickerSearchInput"); input.value = ""; renderCollectionPickerResults(""); input.focus(); });
    document.getElementById("momentsCollectionPickerResults")?.addEventListener("click", event => { const button = event.target.closest("[data-add-existing-collection]"); if (button) void addJourneyToExistingCollection(button.dataset.addExistingCollection, button); });
    document.querySelector("[data-moments-create-back]")?.addEventListener("click", () => setCollectionPickerStep("choice"));
    document.querySelector("[data-moments-create-cancel]")?.addEventListener("click", closeCollectionPicker);
    document.getElementById("momentsCreateJourneySearch")?.addEventListener("input", event => renderCreateJourneyLists(event.currentTarget.value));
    document.getElementById("momentsCreatePhotoInput")?.addEventListener("change", addCreatePhotos);
    document.getElementById("momentsCreatePhotos")?.addEventListener("click", event => { const button = event.target.closest("[data-remove-create-photo]"); if (!button) return; const photo = state.pickerCreatePhotos.find(item => item.id === button.dataset.removeCreatePhoto); if (photo?.temporary) URL.revokeObjectURL(photo.url); state.pickerCreatePhotos = state.pickerCreatePhotos.filter(item => item.id !== button.dataset.removeCreatePhoto); renderCreatePhotos(); });
    document.getElementById("momentsCollectionCreate")?.addEventListener("click", event => { const add = event.target.closest("[data-add-create-journey]"), remove = event.target.closest("[data-remove-create-journey]"); if (add) state.pickerSelectedJourneyIds.add(String(add.dataset.addCreateJourney)); if (remove) state.pickerSelectedJourneyIds.delete(String(remove.dataset.removeCreateJourney)); if (add || remove) renderCreateJourneyLists(); });
    document.getElementById("momentsCollectionCreate")?.addEventListener("submit", saveCreatedCollection);
    document.querySelectorAll("[data-moments-search-toggle]").forEach(button => button.addEventListener("click", () => setSearchOpen(button.dataset.momentsSearchToggle, true)));
    document.querySelectorAll("[data-moments-search-close]").forEach(button => button.addEventListener("click", () => clearSectionSearch(button.dataset.momentsSearchClose)));
    document.querySelectorAll("[data-moments-search-input]").forEach(input => {
      input.addEventListener("input", event => {
        const category = event.currentTarget.dataset.momentsSearchInput; state.searchQueries[category] = searchValue(event.currentTarget.value);
        if (category === "memories") applyMemorySearch();
        if (category === "collections") applyCollectionSearch();
        if (category === "journeys") renderJourneys();
      });
      input.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); clearSectionSearch(event.currentTarget.dataset.momentsSearchInput); } });
    });
    document.querySelector("[data-moments-view-all]")?.addEventListener("click", () => { state.expandedJourneys = !state.expandedJourneys; renderJourneys(); });
    document.addEventListener("journeydeck:collectionchanged", event => { if (event.detail?.collectionId) { state.collectionHeroes.delete(event.detail.collectionId); state.collectionHeroPromises.delete(event.detail.collectionId); } void loadData(state.records[state.selectedMemory]?.id); });
    document.addEventListener("journeydeck:viewchange", event => document.body.classList.toggle("moments-view-active", event.detail?.view === "drives"));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && collectionPickerModal()?.classList.contains("open")) { closeCollectionPicker(); return; } if (event.key === "Escape" && document.getElementById("memoryDetailsModal")?.classList.contains("open")) closeMemoryModal(); });
  }

  function mount() {
    if (state.mounted || !document.querySelector(".moments-page")) return;
    state.mounted = true; bindActions(); setSearchOpen("", false); renderJourneys(); renderMemoryCards("summer-2026"); void loadData("summer-2026");
    document.body.classList.toggle("moments-view-active", (location.hash || "#dashboard") === "#drives");
  }
  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.moments = Object.freeze({ mount, setJourneys, setCollections, renderJourneys, selectMemory, openMemoryModal, openCollectionPicker });
  // This script is loaded at the end of index.html, after every Moments node.
  // Mount immediately so dynamic cards cannot be rendered before their actions
  // are bound while the rest of the document is still finishing DOMContentLoaded.
  mount();
})();
