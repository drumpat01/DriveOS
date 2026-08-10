(function () {
  const $ = window.DriveOSDom.byId;
  const storageKey = "driveos-dashboard-layout-v1";
  const validSizes = new Set(["compact", "standard", "wide"]);

  function create() {
    const widgets = () => [...document.querySelectorAll("[data-dashboard-widget]")];
    let layout = null;
    let draggedId = null;

    function defaults() {
      const items = widgets();
      return {
        order: items.map(widget => widget.dataset.dashboardWidget),
        hidden: [],
        pinned: [],
        sizes: Object.fromEntries(items.map(widget => [widget.dataset.dashboardWidget, widget.dataset.dashboardDefaultSize || "standard"]))
      };
    }

    function sanitize(candidate) {
      const base = defaults();
      const ids = new Set(base.order);
      const order = [...new Set([...(Array.isArray(candidate?.order) ? candidate.order : []), ...base.order])].filter(id => ids.has(id));
      const hidden = [...new Set(Array.isArray(candidate?.hidden) ? candidate.hidden : [])].filter(id => ids.has(id));
      const pinned = [...new Set(Array.isArray(candidate?.pinned) ? candidate.pinned : [])].filter(id => ids.has(id));
      const sizes = { ...base.sizes };
      Object.entries(candidate?.sizes || {}).forEach(([id, size]) => {
        if (ids.has(id) && validSizes.has(size)) sizes[id] = size;
      });
      return { order, hidden, pinned, sizes };
    }

    function load() {
      try { return sanitize(JSON.parse(localStorage.getItem(storageKey) || "null")); }
      catch { return defaults(); }
    }

    function save() {
      try { localStorage.setItem(storageKey, JSON.stringify(layout)); } catch {}
      apply();
      renderEditor();
    }

    function sortedIds() {
      return [...layout.order].sort((a, b) => {
        const pinDifference = Number(layout.pinned.includes(b)) - Number(layout.pinned.includes(a));
        return pinDifference || layout.order.indexOf(a) - layout.order.indexOf(b);
      });
    }

    function updateStatus() {
      const status = $("dashboardLayoutStatus");
      if (!status) return;
      const hiddenCount = layout.hidden.length;
      const pinnedCount = layout.pinned.length;
      status.textContent = `${pinnedCount} pinned \u00B7 ${hiddenCount} hidden \u00B7 saved on this device`;
    }

    function apply() {
      const grid = $("dashboardWidgetGrid");
      if (!grid) return;
      const byId = new Map(widgets().map(widget => [widget.dataset.dashboardWidget, widget]));
      sortedIds().forEach(id => {
        const widget = byId.get(id);
        if (!widget) return;
        widget.hidden = layout.hidden.includes(id);
        widget.classList.remove("dashboard-size-compact", "dashboard-size-standard", "dashboard-size-wide");
        widget.classList.add(`dashboard-size-${layout.sizes[id] || "standard"}`);
        widget.classList.toggle("dashboard-widget-pinned", layout.pinned.includes(id));
        widget.dataset.dashboardPinned = layout.pinned.includes(id) ? "true" : "false";
        grid.appendChild(widget);
      });
      updateStatus();
    }

    function move(id, direction) {
      const index = layout.order.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= layout.order.length) return;
      [layout.order[index], layout.order[target]] = [layout.order[target], layout.order[index]];
      save();
    }

    function toggleListValue(key, id, enabled) {
      const values = new Set(layout[key]);
      enabled ? values.add(id) : values.delete(id);
      layout[key] = [...values];
      save();
    }

    function reorderDragged(targetId) {
      if (!draggedId || draggedId === targetId) return;
      const order = layout.order.filter(id => id !== draggedId);
      const targetIndex = order.indexOf(targetId);
      order.splice(Math.max(0, targetIndex), 0, draggedId);
      layout.order = order;
      draggedId = null;
      save();
    }

    function editorRow(id, index) {
      const widget = document.querySelector(`[data-dashboard-widget="${id}"]`);
      const row = document.createElement("div");
      row.className = "dashboard-customizer-row";
      row.draggable = true;
      row.dataset.dashboardEditorId = id;

      const drag = document.createElement("span");
      drag.className = "dashboard-drag-handle";
      drag.textContent = "\u2637";
      drag.title = "Drag to rearrange";
      drag.setAttribute("aria-hidden", "true");
      const name = document.createElement("strong");
      name.textContent = widget?.dataset.dashboardTitle || id;

      const orderButtons = document.createElement("span");
      orderButtons.className = "dashboard-order-buttons";
      const up = document.createElement("button");
      up.type = "button"; up.className = "dashboard-icon-button"; up.textContent = "\u2191"; up.title = "Move up"; up.setAttribute("aria-label", `Move ${name.textContent} up`); up.disabled = index === 0;
      const down = document.createElement("button");
      down.type = "button"; down.className = "dashboard-icon-button"; down.textContent = "\u2193"; down.title = "Move down"; down.setAttribute("aria-label", `Move ${name.textContent} down`); down.disabled = index === layout.order.length - 1;
      up.addEventListener("click", () => move(id, -1));
      down.addEventListener("click", () => move(id, 1));
      orderButtons.append(up, down);

      const size = document.createElement("select");
      size.className = "dashboard-size-select";
      size.setAttribute("aria-label", `Size for ${name.textContent}`);
      [["compact", "Compact"], ["standard", "Standard"], ["wide", "Wide"]].forEach(([value, label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = layout.sizes[id] === value; size.appendChild(option);
      });
      size.addEventListener("change", () => { layout.sizes[id] = size.value; save(); });

      const pinLabel = document.createElement("label");
      pinLabel.className = "dashboard-toggle-label";
      const pin = document.createElement("input"); pin.type = "checkbox"; pin.checked = layout.pinned.includes(id); pin.addEventListener("change", () => toggleListValue("pinned", id, pin.checked));
      pinLabel.append(pin, document.createTextNode("Pin"));

      const showLabel = document.createElement("label");
      showLabel.className = "dashboard-toggle-label";
      const show = document.createElement("input"); show.type = "checkbox"; show.checked = !layout.hidden.includes(id); show.addEventListener("change", () => toggleListValue("hidden", id, !show.checked));
      showLabel.append(show, document.createTextNode("Show"));

      row.append(drag, name, orderButtons, size, pinLabel, showLabel);
      row.addEventListener("dragstart", event => { draggedId = id; row.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; });
      row.addEventListener("dragend", () => { draggedId = null; row.classList.remove("dragging"); });
      row.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
      row.addEventListener("drop", event => { event.preventDefault(); reorderDragged(id); });
      return row;
    }

    function renderEditor() {
      const list = $("dashboardCustomizerList");
      if (!list || !layout) return;
      list.replaceChildren(...layout.order.map(editorRow));
    }

    function setEditorOpen(open) {
      const editor = $("dashboardCustomizer");
      const button = $("dashboardCustomizeButton");
      if (!editor || !button) return;
      editor.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.textContent = open ? "Done customizing" : "Customize dashboard";
      document.body.classList.toggle("dashboard-editing", open);
      if (open) renderEditor();
    }

    function reset() {
      layout = defaults();
      try { localStorage.removeItem(storageKey); } catch {}
      apply();
      renderEditor();
    }

    function bind() {
      layout = load();
      apply();
      $("dashboardCustomizeButton")?.addEventListener("click", event => setEditorOpen(event.currentTarget.getAttribute("aria-expanded") !== "true"));
      $("dashboardResetLayout")?.addEventListener("click", reset);
    }

    return Object.freeze({ bind, apply, reset });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.dashboardCustomization = Object.freeze({ create });
})();
