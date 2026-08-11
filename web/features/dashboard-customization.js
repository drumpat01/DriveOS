(function () {
  const $ = window.DriveOSDom.byId;
  const storageKey = "driveos-dashboard-layout-v1";
  const validSizes = new Set(["compact", "standard", "wide"]);
  const sizeOrder = ["compact", "standard", "wide"];

  function create() {
    const widgets = () => [...document.querySelectorAll("[data-dashboard-widget]")];
    let layout = null;
    let draggedId = null;
    let resizeState = null;
    let pendingBlankDrop = null;
    let pointerDragState = null;

    function defaults() {
      const items = widgets();
      return {
        order: items.map(widget => widget.dataset.dashboardWidget),
        hidden: [],
        pinned: [],
        positions: {},
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
      const positions = {};
      Object.entries(candidate?.positions || {}).forEach(([id, position]) => {
        const row = Math.max(1, Math.min(50, Math.round(Number(position?.row) || 0)));
        const col = Math.max(1, Math.min(12, Math.round(Number(position?.col) || 0)));
        if (ids.has(id) && row && col) positions[id] = { row, col };
      });
      return { order, hidden, pinned, positions, sizes };
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
        const position = layout.positions[id];
        const span = sizeSpan(id);
        if (position) {
          const col = span === 12 ? 1 : Math.min(position.col, 13 - span);
          position.col = col;
          widget.style.gridColumn = span === 12 ? "1 / -1" : `${col} / span ${span}`;
          widget.style.gridRowStart = String(position.row);
          widget.dataset.dashboardPlaced = "true";
        } else {
          widget.style.gridColumn = "";
          widget.style.gridRowStart = "";
          delete widget.dataset.dashboardPlaced;
        }
        grid.appendChild(widget);
      });
      updateStatus();
    }

    function move(id, direction) {
      const index = layout.order.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= layout.order.length) return;
      [layout.order[index], layout.order[target]] = [layout.order[target], layout.order[index]];
      delete layout.positions[id];
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
      const sourceId = draggedId;
      const order = layout.order.filter(id => id !== sourceId);
      const targetIndex = order.indexOf(targetId);
      order.splice(Math.max(0, targetIndex), 0, sourceId);
      layout.order = order;
      delete layout.positions[sourceId];
      draggedId = null;
      save();
    }

    function sizeSpan(id) {
      const size = layout?.sizes?.[id] || "standard";
      return size === "compact" ? 4 : size === "wide" ? 12 : 6;
    }

    function canDragWidgets() {
      return window.matchMedia("(min-width: 1101px)").matches;
    }

    function updateResizeGraphic(widget, size) {
      widget.querySelectorAll(".dashboard-resize-step").forEach(step => {
        step.classList.toggle("active", step.dataset.dashboardResizeSize === size);
      });
      const label = widget.querySelector(".dashboard-resize-current");
      if (label) label.textContent = size[0].toUpperCase() + size.slice(1);
    }

    function previewWidgetSize(widget, size) {
      widget.classList.remove("dashboard-size-compact", "dashboard-size-standard", "dashboard-size-wide");
      widget.classList.add(`dashboard-size-${size}`);
      updateResizeGraphic(widget, size);
    }

    function nearestSize(projectedWidth) {
      const grid = $("dashboardWidgetGrid");
      const gridWidth = grid?.getBoundingClientRect().width || projectedWidth;
      const widths = [gridWidth / 3, gridWidth / 2, gridWidth];
      let best = 0;
      widths.forEach((width, index) => {
        if (Math.abs(width - projectedWidth) < Math.abs(widths[best] - projectedWidth)) best = index;
      });
      return sizeOrder[best];
    }

    function beginWidgetResize(event, widget, handle) {
      if (!canDragWidgets()) return;
      event.preventDefault();
      event.stopPropagation();
      const id = widget.dataset.dashboardWidget;
      resizeState = {
        id,
        widget,
        handle,
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: widget.getBoundingClientRect().width,
        originalSize: layout.sizes[id] || "standard",
        previewSize: layout.sizes[id] || "standard"
      };
      handle.setPointerCapture?.(event.pointerId);
      widget.classList.add("dashboard-widget-resizing");
      updateResizeGraphic(widget, resizeState.previewSize);
    }

    function moveWidgetResize(event) {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return;
      event.preventDefault();
      const size = nearestSize(resizeState.startWidth + event.clientX - resizeState.startX);
      if (size === resizeState.previewSize) return;
      resizeState.previewSize = size;
      previewWidgetSize(resizeState.widget, size);
    }

    function finishWidgetResize(event, commit) {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return;
      const state = resizeState;
      resizeState = null;
      state.handle.releasePointerCapture?.(event.pointerId);
      state.widget.classList.remove("dashboard-widget-resizing");
      if (commit) {
        layout.sizes[state.id] = state.previewSize;
        if (layout.positions[state.id]) layout.positions[state.id].col = Math.min(layout.positions[state.id].col, 13 - sizeSpan(state.id));
        save();
      } else {
        previewWidgetSize(state.widget, state.originalSize);
      }
    }

    function resizeGraphic() {
      const graphic = document.createElement("div");
      graphic.className = "dashboard-resize-indicator";
      const current = document.createElement("strong");
      current.className = "dashboard-resize-current";
      const steps = document.createElement("div");
      steps.className = "dashboard-resize-steps";
      sizeOrder.forEach(size => {
        const step = document.createElement("span");
        step.className = "dashboard-resize-step";
        step.dataset.dashboardResizeSize = size;
        step.innerHTML = `<i></i><small>${size[0].toUpperCase()}</small>`;
        steps.append(step);
      });
      graphic.append(current, steps);
      return graphic;
    }

    function addResizeHandle(widget, kind) {
      const handle = document.createElement("span");
      handle.className = `dashboard-widget-resize-handle dashboard-widget-resize-${kind}`;
      handle.role = "slider";
      handle.tabIndex = 0;
      handle.setAttribute("aria-label", `Resize ${widget.dataset.dashboardTitle || "panel"}`);
      handle.setAttribute("aria-valuemin", "1");
      handle.setAttribute("aria-valuemax", "3");
      handle.addEventListener("pointerdown", event => beginWidgetResize(event, widget, handle));
      handle.addEventListener("pointermove", moveWidgetResize);
      handle.addEventListener("pointerup", event => finishWidgetResize(event, true));
      handle.addEventListener("pointercancel", event => finishWidgetResize(event, false));
      handle.addEventListener("keydown", event => {
        if (!canDragWidgets() || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const id = widget.dataset.dashboardWidget;
        const index = sizeOrder.indexOf(layout.sizes[id] || "standard");
        const next = Math.max(0, Math.min(sizeOrder.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
        layout.sizes[id] = sizeOrder[next];
        save();
      });
      widget.append(handle);
      return handle;
    }

    function widgetDropTarget(event) {
      const widget = event.target.closest("[data-dashboard-widget]");
      return widget?.dataset.dashboardWidget || null;
    }

    function clearDropVisuals() {
      pendingBlankDrop = null;
      widgets().forEach(widget => widget.classList.remove("dashboard-widget-drop-target"));
      $("dashboardWidgetGrid")?.classList.remove("dashboard-grid-accepting-drop");
      $("dashboardGridDropPreview")?.remove();
    }

    function visibleGridRows(gridRect) {
      const items = widgets()
        .filter(widget => !widget.hidden && widget.dataset.dashboardWidget !== draggedId)
        .map(widget => ({ widget, rect: widget.getBoundingClientRect() }))
        .filter(item => item.rect.width > 0 && item.rect.height > 0)
        .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
      const rows = [];
      items.forEach(item => {
        let row = rows.find(candidate => Math.abs(candidate.top - item.rect.top) < 10);
        if (!row) {
          row = { top: item.rect.top, bottom: item.rect.bottom, items: [] };
          rows.push(row);
        }
        row.bottom = Math.max(row.bottom, item.rect.bottom);
        row.items.push(item);
      });
      return rows.sort((a, b) => a.top - b.top).map((row, index) => ({ ...row, number: index + 1, gridTop: row.top - gridRect.top }));
    }

    function blankDropPosition(event) {
      const grid = $("dashboardWidgetGrid");
      if (!grid || !draggedId) return null;
      const gridRect = grid.getBoundingClientRect();
      const styles = getComputedStyle(grid);
      const gap = Number.parseFloat(styles.columnGap) || 18;
      const unit = (gridRect.width + gap) / 12;
      const span = sizeSpan(draggedId);
      const rows = visibleGridRows(gridRect);
      const y = event.clientY;
      let row = rows.find(candidate => y >= candidate.top - gap / 2 && y <= candidate.bottom + gap / 2);
      if (!row) {
        if (rows.length && y < rows[0].top) row = rows[0];
        else {
          const last = rows[rows.length - 1];
          row = { number: (last?.number || 0) + 1, top: (last?.bottom || gridRect.top) + gap, bottom: (last?.bottom || gridRect.top) + gap, gridTop: (last ? last.bottom - gridRect.top : 0) + gap, items: [] };
        }
      }
      const occupied = Array(12).fill(false);
      row.items.forEach(item => {
        const start = Math.max(0, Math.round((item.rect.left - gridRect.left) / unit));
        const itemSpan = sizeSpan(item.widget.dataset.dashboardWidget);
        for (let index = start; index < Math.min(12, start + itemSpan); index += 1) occupied[index] = true;
      });
      const desired = Math.max(1, Math.min(13 - span, Math.floor((event.clientX - gridRect.left) / unit) + 1));
      const available = [];
      for (let col = 1; col <= 13 - span; col += 1) {
        if (occupied.slice(col - 1, col - 1 + span).every(value => !value)) available.push(col);
      }
      if (!available.length) return null;
      const col = available.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired))[0];
      return { row: row.number, col, top: row.gridTop, height: Math.max(row.bottom - row.top, document.querySelector(`[data-dashboard-widget="${draggedId}"]`)?.getBoundingClientRect().height || 220), left: (col - 1) * unit, width: span * unit - gap };
    }

    function showBlankDropPreview(position) {
      const grid = $("dashboardWidgetGrid");
      if (!grid || !position) return;
      let preview = $("dashboardGridDropPreview");
      if (!preview) {
        preview = document.createElement("div");
        preview.id = "dashboardGridDropPreview";
        preview.className = "dashboard-grid-drop-preview";
        preview.innerHTML = "<strong>Place widget here</strong><span>Release to save this grid position</span>";
        grid.append(preview);
      }
      preview.style.left = `${position.left}px`;
      preview.style.top = `${position.top}px`;
      preview.style.width = `${position.width}px`;
      preview.style.height = `${position.height}px`;
      grid.classList.add("dashboard-grid-accepting-drop");
    }

    function pointerDropTarget(clientX, clientY) {
      const element = document.elementFromPoint(clientX, clientY);
      const widget = element?.closest?.("[data-dashboard-widget]");
      const id = widget?.dataset.dashboardWidget || null;
      return id && id !== draggedId ? id : null;
    }

    function updatePointerDropTarget(clientX, clientY) {
      const targetId = pointerDropTarget(clientX, clientY);
      widgets().forEach(widget => {
        widget.classList.toggle(
          "dashboard-widget-drop-target",
          widget.dataset.dashboardWidget === targetId
        );
      });
      return targetId;
    }

    function beginPointerWidgetDrag(event, widget, handle) {
      if (event.pointerType === "mouse" && canDragWidgets()) return;
      if (event.button != null && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      draggedId = widget.dataset.dashboardWidget;
      pointerDragState = {
        pointerId: event.pointerId,
        widget,
        handle,
        targetId: null
      };

      handle.setPointerCapture?.(event.pointerId);
      widget.classList.add("dashboard-widget-dragging");
      document.body.classList.add("dashboard-pointer-dragging");
      pointerDragState.targetId = updatePointerDropTarget(event.clientX, event.clientY);
    }

    function movePointerWidgetDrag(event) {
      if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;

      event.preventDefault();
      pointerDragState.targetId = updatePointerDropTarget(event.clientX, event.clientY);

      const edge = 72;
      if (event.clientY < edge) {
        window.scrollBy({ top: -18, behavior: "auto" });
      } else if (event.clientY > window.innerHeight - edge) {
        window.scrollBy({ top: 18, behavior: "auto" });
      }
    }

    function finishPointerWidgetDrag(event, commit) {
      if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;

      event.preventDefault();
      const dragState = pointerDragState;
      pointerDragState = null;

      dragState.handle.releasePointerCapture?.(event.pointerId);
      dragState.widget.classList.remove("dashboard-widget-dragging");
      document.body.classList.remove("dashboard-pointer-dragging");

      const targetId = dragState.targetId || pointerDropTarget(event.clientX, event.clientY);
      widgets().forEach(widget => widget.classList.remove("dashboard-widget-drop-target"));

      if (commit && targetId && draggedId) {
        reorderDragged(targetId);
      } else {
        draggedId = null;
      }

      clearDropVisuals();
    }

    function setWidgetDragging(enabled) {
      widgets().forEach(widget => {
        let handle = widget.querySelector(".dashboard-widget-drag-handle");
        if (!handle) {
          handle = document.createElement("button");
          handle.type = "button";
          handle.className = "dashboard-widget-drag-handle";
          handle.textContent = "\u2637";
          handle.title = "Drag to rearrange this panel";
          handle.setAttribute("aria-label", `Drag ${widget.dataset.dashboardTitle || "panel"} to rearrange`);
          widget.append(handle);
          handle.addEventListener("dragstart", event => {
            if (!canDragWidgets()) { event.preventDefault(); return; }
            draggedId = widget.dataset.dashboardWidget;
            widget.classList.add("dashboard-widget-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", draggedId);
          });
          handle.addEventListener("dragend", () => {
            draggedId = null;
            widgets().forEach(item => item.classList.remove("dashboard-widget-dragging", "dashboard-widget-drop-target"));
            clearDropVisuals();
          });
          handle.addEventListener("pointerdown", event => beginPointerWidgetDrag(event, widget, handle));
          handle.addEventListener("pointermove", movePointerWidgetDrag);
          handle.addEventListener("pointerup", event => finishPointerWidgetDrag(event, true));
          handle.addEventListener("pointercancel", event => finishPointerWidgetDrag(event, false));
        }
        handle.draggable = enabled && canDragWidgets();
        handle.hidden = !enabled;

        if (!widget.querySelector(".dashboard-resize-indicator")) widget.append(resizeGraphic());
        if (!widget.querySelector(".dashboard-widget-resize-edge")) addResizeHandle(widget, "edge");
        if (!widget.querySelector(".dashboard-widget-resize-corner")) addResizeHandle(widget, "corner");
        widget.querySelectorAll(".dashboard-widget-resize-handle").forEach(resizeHandle => {
          resizeHandle.hidden = !enabled || !canDragWidgets();
          resizeHandle.setAttribute("aria-valuenow", String(sizeOrder.indexOf(layout.sizes[widget.dataset.dashboardWidget] || "standard") + 1));
          resizeHandle.setAttribute("aria-valuetext", layout.sizes[widget.dataset.dashboardWidget] || "standard");
        });
      });
    }

    function bindWidgetDropEvents() {
      const grid = $("dashboardWidgetGrid");
      if (!grid || grid.dataset.dashboardDropBound) return;
      grid.dataset.dashboardDropBound = "true";
      grid.addEventListener("dragover", event => {
        if (!draggedId || !canDragWidgets()) return;
        const targetId = widgetDropTarget(event);
        if (targetId && targetId !== draggedId) {
          event.preventDefault();
          pendingBlankDrop = null;
          $("dashboardGridDropPreview")?.remove();
          event.dataTransfer.dropEffect = "move";
          widgets().forEach(widget => widget.classList.toggle("dashboard-widget-drop-target", widget.dataset.dashboardWidget === targetId));
          return;
        }
        if (!targetId) {
          const position = blankDropPosition(event);
          if (!position) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          widgets().forEach(widget => widget.classList.remove("dashboard-widget-drop-target"));
          pendingBlankDrop = position;
          showBlankDropPreview(position);
        }
      });
      grid.addEventListener("dragleave", event => {
        const targetId = widgetDropTarget(event);
        if (targetId) document.querySelector(`[data-dashboard-widget="${targetId}"]`)?.classList.remove("dashboard-widget-drop-target");
        if (!grid.contains(event.relatedTarget)) clearDropVisuals();
      });
      grid.addEventListener("drop", event => {
        if (!draggedId || !canDragWidgets()) return;
        const targetId = widgetDropTarget(event);
        if (!targetId && pendingBlankDrop) {
          event.preventDefault();
          const sourceId = draggedId;
          layout.positions[sourceId] = { row: pendingBlankDrop.row, col: pendingBlankDrop.col };
          draggedId = null;
          clearDropVisuals();
          save();
          return;
        }
        if (!targetId) return;
        event.preventDefault();
        reorderDragged(targetId);
        clearDropVisuals();
      });
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
      setWidgetDragging(open);
      if (!open) {
        pointerDragState = null;
        draggedId = null;
        document.body.classList.remove("dashboard-pointer-dragging");
        widgets().forEach(widget => widget.classList.remove("dashboard-widget-dragging", "dashboard-widget-drop-target"));
        clearDropVisuals();
      }
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
      bindWidgetDropEvents();
      $("dashboardCustomizeButton")?.addEventListener("click", event => setEditorOpen(event.currentTarget.getAttribute("aria-expanded") !== "true"));
      $("dashboardResetLayout")?.addEventListener("click", reset);
    }

    return Object.freeze({ bind, apply, reset });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.dashboardCustomization = Object.freeze({ create });
})();
