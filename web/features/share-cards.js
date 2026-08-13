(function () {
  const $ = window.DriveOSDom.byId;

  function create({ state, api }) {
    const width = 1080;
    const height = 1350;
    let artwork = null;
    let mapArtwork = null;

    const themes = Object.freeze({
      electric: { bg1: "#07131d", bg2: "#0b2330", bg3: "#061019", text: "#f4fbff", muted: "#9eb8c5", accent: "#83e8ff", accent2: "#86f1c5", panel: "rgba(255,255,255,.055)", mapTint: "rgba(2,14,21,.22)", backdropVeil: "rgba(3,13,20,.38)", footer: "#7e9ba8" },
      sunset: { bg1: "#241025", bg2: "#542532", bg3: "#171124", text: "#fff7f0", muted: "#e4b7ad", accent: "#ffbd76", accent2: "#ff8e7a", panel: "rgba(255,244,228,.075)", mapTint: "rgba(39,7,28,.28)", backdropVeil: "rgba(34,8,27,.36)", footer: "#d2a6a3" },
      paper: { bg1: "#f7f4ec", bg2: "#e8eef0", bg3: "#f5f1e8", text: "#102832", muted: "#58727a", accent: "#087f91", accent2: "#168763", panel: "rgba(10,53,65,.075)", mapTint: "rgba(238,244,241,.18)", backdropVeil: "rgba(244,244,238,.44)", footer: "#60777c" }
    });

    function selection(id, fallback) {
      return $(id)?.value || fallback;
    }

    function activeTheme() {
      return themes[selection("shareCardTheme", "electric")] || themes.electric;
    }

    function roundRect(ctx, x, y, w, h, radius) {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
      const words = String(text || "").split(/\s+/);
      const lines = [];
      let line = "";
      words.forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = next;
      });
      if (line) lines.push(line);
      lines.slice(0, maxLines).forEach((value, index) => {
        let output = value;
        if (index === maxLines - 1 && lines.length > maxLines) {
          while (ctx.measureText(`${output}…`).width > maxWidth && output.length > 1) output = output.slice(0, -1);
          output += "…";
        }
        ctx.fillText(output, x, y + index * lineHeight);
      });
      return Math.min(lines.length, maxLines) * lineHeight;
    }

    function drawImageCover(ctx, image, x, y, w, h, overscan = 0) {
      const imageWidth = image.naturalWidth || image.width;
      const imageHeight = image.naturalHeight || image.height;
      if (!imageWidth || !imageHeight) return;
      const scale = Math.max((w + overscan * 2) / imageWidth, (h + overscan * 2) / imageHeight);
      const drawWidth = imageWidth * scale;
      const drawHeight = imageHeight * scale;
      ctx.drawImage(image, x + (w - drawWidth) / 2, y + (h - drawHeight) / 2, drawWidth, drawHeight);
    }

    function selectedStats(card) {
      const choices = [...document.querySelectorAll("[data-share-stat]:checked")].map(input => input.value);
      const values = {
        distance: ["DISTANCE", `${card.stats.miles ?? "--"} miles`],
        duration: ["DURATION", `${card.stats.durationMinutes ?? "--"} minutes`],
        efficiency: ["EFFICIENCY", card.stats.efficiencyWhMi != null ? `${card.stats.efficiencyWhMi} Wh/mi` : "--"],
        songs: ["SOUNDTRACK", `${card.stats.songs || 0} song${card.stats.songs === 1 ? "" : "s"}`],
        artist: ["TOP ARTIST", card.stats.topArtist || "No artist data"]
      };
      return choices.map(key => values[key]).filter(Boolean).slice(0, 5);
    }

    function drawRoute(ctx, card, box) {
      const theme = activeTheme();
      const mapStyle = selection("shareCardMapStyle", "street");
      ctx.save();
      roundRect(ctx, box.x, box.y, box.w, box.h, 34);
      ctx.clip();
      if (mapArtwork && mapStyle !== "route") {
        ctx.drawImage(mapArtwork, box.x, box.y, box.w, box.h);
        ctx.fillStyle = mapStyle === "dim" ? "rgba(2, 10, 17, .58)" : theme.mapTint;
        ctx.fillRect(box.x, box.y, box.w, box.h);
      } else {
        const mapGradient = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
        mapGradient.addColorStop(0, theme.bg2);
        mapGradient.addColorStop(1, theme.bg1);
        ctx.fillStyle = mapGradient;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = "rgba(137, 245, 189, .08)";
        ctx.lineWidth = 1;
        for (let gx = box.x + 55; gx < box.x + box.w; gx += 72) {
          ctx.beginPath(); ctx.moveTo(gx, box.y); ctx.lineTo(gx, box.y + box.h); ctx.stroke();
        }
        for (let gy = box.y + 40; gy < box.y + box.h; gy += 72) {
          ctx.beginPath(); ctx.moveTo(box.x, gy); ctx.lineTo(box.x + box.w, gy); ctx.stroke();
        }
      }

      const points = card.route?.points || [];
      const px = point => box.x + 70 + Number(point.x) * (box.w - 140);
      const py = point => box.y + 60 + Number(point.y) * (box.h - 120);
      if ((!mapArtwork || mapStyle === "route") && points.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(8, 10, 14, .55)";
        ctx.lineWidth = 23;
        ctx.beginPath(); ctx.moveTo(px(points[0]), py(points[0]));
        points.slice(1).forEach(point => ctx.lineTo(px(point), py(point))); ctx.stroke();
        const routeGradient = ctx.createLinearGradient(box.x, box.y + box.h, box.x + box.w, box.y);
        routeGradient.addColorStop(0, "#09b4c8");
        routeGradient.addColorStop(1, "#20d49e");
        ctx.strokeStyle = routeGradient;
        ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(px(points[0]), py(points[0]));
        points.slice(1).forEach(point => ctx.lineTo(px(point), py(point))); ctx.stroke();

        [points[0], points[points.length - 1]].forEach((point, index) => {
          ctx.fillStyle = index ? "#20d49e" : "#09b4c8";
          ctx.beginPath(); ctx.arc(px(point), py(point), 20, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#f7ffff"; ctx.lineWidth = 7; ctx.stroke();
        });

        const geoPoints = card.route?.mapPoints || [];
        (card.route?.songMarkers || []).forEach(marker => {
          if (!geoPoints.length || marker.latitude == null || marker.longitude == null) return;
          let nearestIndex = 0;
          let nearestDistance = Infinity;
          geoPoints.forEach((point, index) => {
            const distance = Math.pow(Number(point.latitude) - Number(marker.latitude), 2) + Math.pow(Number(point.longitude) - Number(marker.longitude), 2);
            if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
          });
          const point = points[Math.min(nearestIndex, points.length - 1)];
          if (!point) return;
          const x = px(point);
          const y = py(point);
          ctx.fillStyle = "rgba(1,13,18,.72)";
          ctx.beginPath(); ctx.arc(x, y + 3, 25, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#2bd6a3";
          ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#06161a"; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = "#041316"; ctx.font = '800 19px "Segoe UI", sans-serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(marker.index), x, y + 1);
          ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        });
      }
      ctx.restore();

      ctx.fillStyle = theme.text;
      ctx.font = '700 25px "Segoe UI", sans-serif';
      ctx.textAlign = "left";
      drawWrappedText(ctx, card.startLabel, box.x + 34, box.y + box.h - 46, box.w * .4, 29, 2);
      ctx.textAlign = "right";
      drawWrappedText(ctx, card.endLabel, box.x + box.w - 34, box.y + 44, box.w * .4, 29, 2);
      ctx.textAlign = "left";
    }

    function render() {
      const canvas = $("shareCardCanvas");
      const card = state.shareCardData;
      if (!canvas || !card) return;
      const ctx = canvas.getContext("2d");
      const theme = activeTheme();
      const artworkStyle = selection("shareCardArtwork", "album");
      canvas.width = width;
      canvas.height = height;

      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, theme.bg1);
      background.addColorStop(.52, theme.bg2);
      background.addColorStop(1, theme.bg3);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      if (artwork && artworkStyle === "backdrop") {
        ctx.save();
        ctx.globalAlpha = .68;
        ctx.filter = "blur(42px) saturate(1.18) contrast(1.08)";
        drawImageCover(ctx, artwork, 0, 0, width, height, 90);
        ctx.restore();
        ctx.fillStyle = theme.backdropVeil;
        ctx.fillRect(0, 0, width, height);
        const readability = ctx.createLinearGradient(0, 0, 0, height);
        if (selection("shareCardTheme", "electric") === "paper") {
          readability.addColorStop(0, "rgba(255,255,250,.12)");
          readability.addColorStop(.52, "rgba(255,255,250,.28)");
          readability.addColorStop(1, "rgba(255,255,250,.56)");
        } else {
          readability.addColorStop(0, "rgba(2,8,13,.08)");
          readability.addColorStop(.52, "rgba(2,8,13,.18)");
          readability.addColorStop(1, "rgba(2,8,13,.42)");
        }
        ctx.fillStyle = readability;
        ctx.fillRect(0, 0, width, height);
      }

      if (artworkStyle !== "backdrop") {
        const glow = ctx.createRadialGradient(870, 160, 10, 870, 160, 440);
        glow.addColorStop(0, "rgba(29, 214, 157, .27)");
        glow.addColorStop(1, "rgba(29, 214, 157, 0)");
        ctx.fillStyle = glow; ctx.fillRect(430, 0, 650, 600);
      }

      ctx.fillStyle = theme.accent;
      ctx.font = '800 24px "Segoe UI", sans-serif';
      ctx.letterSpacing = "5px";
      ctx.fillText("JOURNEYDECK · ROAD NOTE", 72, 72);
      ctx.letterSpacing = "0px";

      ctx.fillStyle = theme.text;
      ctx.font = '800 66px "Segoe UI", sans-serif';
      drawWrappedText(ctx, card.title, 72, 155, artwork && artworkStyle === "album" ? 620 : 920, 72, 2);
      ctx.fillStyle = theme.muted;
      ctx.font = '600 31px "Segoe UI", sans-serif';
      drawWrappedText(ctx, `${card.startLabel} \u2192 ${card.endLabel}`, 72, 282, artwork && artworkStyle === "album" ? 620 : 920, 39, 2);

      if (artwork && artworkStyle === "album") {
        ctx.save();
        roundRect(ctx, 760, 76, 248, 248, 28); ctx.clip();
        ctx.drawImage(artwork, 760, 76, 248, 248); ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2;
        roundRect(ctx, 760, 76, 248, 248, 28); ctx.stroke();
      }

      drawRoute(ctx, card, { x: 72, y: 350, w: 936, h: 430 });

      const stats = selectedStats(card);
      const columns = 2;
      const gap = 18;
      const cellWidth = (936 - gap) / columns;
      stats.forEach((entry, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const x = 72 + col * (cellWidth + gap);
        const y = 815 + row * 112;
        const wideLast = stats.length % 2 === 1 && index === stats.length - 1;
        const w = wideLast ? 936 : cellWidth;
        ctx.fillStyle = theme.panel;
        roundRect(ctx, x, y, w, 94, 22); ctx.fill();
        ctx.fillStyle = theme.accent; ctx.font = '800 17px "Segoe UI", sans-serif'; ctx.fillText(entry[0], x + 24, y + 30);
        ctx.fillStyle = theme.text; ctx.font = '700 30px "Segoe UI", sans-serif';
        drawWrappedText(ctx, entry[1], x + 24, y + 68, w - 48, 34, 1);
      });

      const featuredY = stats.length > 4 ? 1165 : stats.length > 2 ? 1055 : 945;
      if (card.featured?.momentContext) {
        ctx.fillStyle = theme.accent2; ctx.font = '800 18px "Segoe UI", sans-serif'; ctx.fillText("A MOMENT FROM THE SOUNDTRACK", 72, featuredY);
        ctx.fillStyle = theme.text; ctx.font = '700 32px "Segoe UI", sans-serif';
        drawWrappedText(ctx, `\u201c${card.featured.track}\u201d ${card.featured.momentContext}`, 72, featuredY + 46, 936, 39, 2);
      }

      ctx.strokeStyle = "rgba(255,255,255,.11)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(72, 1282); ctx.lineTo(1008, 1282); ctx.stroke();
      ctx.fillStyle = theme.footer; ctx.font = '600 19px "Segoe UI", sans-serif';
      ctx.fillText("Made locally with JourneyDeck", 72, 1323);
      ctx.textAlign = "right";
      ctx.fillStyle = card.privacy.homeProtected ? theme.accent2 : theme.footer;
      ctx.fillText(card.privacy.homeProtected ? "HOME LOCATION PROTECTED · SAGINAW, TX" : "STREET ADDRESSES HIDDEN", 1008, 1323);
      ctx.textAlign = "left";
    }

    function loadArtwork(card) {
      artwork = null;
      const trackId = card?.featured?.trackId;
      if (!trackId || !/^[A-Za-z0-9]{10,64}$/.test(trackId)) return Promise.resolve();
      return new Promise(resolve => {
        const image = new Image();
        image.onload = () => { artwork = image; resolve(); };
        image.onerror = () => resolve();
        image.src = `/api/spotify/artwork/${encodeURIComponent(trackId)}`;
      });
    }

    function loadMapArtwork(card) {
      mapArtwork = null;
      const points = (card?.route?.mapPoints || []).filter(point =>
        Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))
      );
      const container = $("shareCardMapRenderer");
      if (!container || points.length < 2 || typeof maplibregl === "undefined") return Promise.resolve();
      container.innerHTML = "";

      return new Promise(resolve => {
        let settled = false;
        let map = null;
        const finish = image => {
          if (settled) return;
          settled = true;
          mapArtwork = image || null;
          try { map?.remove(); } catch {}
          container.innerHTML = "";
          resolve();
        };
        const timeout = setTimeout(() => finish(null), 9000);
        try {
          map = new maplibregl.Map({
            container,
            style: "https://tiles.openfreemap.org/styles/liberty",
            interactive: false,
            attributionControl: false,
            preserveDrawingBuffer: true,
            fadeDuration: 0
          });
          map.once("load", () => {
            const coordinates = points.map(point => [Number(point.longitude), Number(point.latitude)]);
            map.addSource("share-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } } });
            map.addLayer({ id: "share-route-shadow", type: "line", source: "share-route", paint: { "line-color": "rgba(2,10,16,.76)", "line-width": 14, "line-blur": 2 } });
            map.addLayer({ id: "share-route-line", type: "line", source: "share-route", paint: { "line-color": "#16d6b0", "line-width": 7 } });
            map.addSource("share-terminals", { type: "geojson", data: { type: "FeatureCollection", features: [coordinates[0], coordinates[coordinates.length - 1]].map((coordinate, index) => ({ type: "Feature", properties: { kind: index }, geometry: { type: "Point", coordinates: coordinate } })) } });
            map.addLayer({ id: "share-terminal-halo", type: "circle", source: "share-terminals", paint: { "circle-radius": 11, "circle-color": "#f7ffff" } });
            map.addLayer({ id: "share-terminals", type: "circle", source: "share-terminals", paint: { "circle-radius": 7, "circle-color": ["case", ["==", ["get", "kind"], 0], "#09b4c8", "#20d49e"] } });
            const songFeatures = (card.route?.songMarkers || []).filter(marker =>
              Number.isFinite(Number(marker.latitude)) && Number.isFinite(Number(marker.longitude))
            ).map(marker => ({
              type: "Feature",
              properties: { index: Number(marker.index) },
              geometry: { type: "Point", coordinates: [Number(marker.longitude), Number(marker.latitude)] }
            }));
            if (songFeatures.length) {
              map.addSource("share-songs", { type: "geojson", data: { type: "FeatureCollection", features: songFeatures } });
              map.addLayer({ id: "share-song-shadow", type: "circle", source: "share-songs", paint: { "circle-radius": 16, "circle-translate": [0, 3], "circle-color": "rgba(1,13,18,.58)", "circle-blur": .18 } });
              map.addLayer({ id: "share-song-markers", type: "circle", source: "share-songs", paint: { "circle-radius": 13, "circle-color": "#2bd6a3", "circle-stroke-width": 2, "circle-stroke-color": "#06161a" } });
              map.addLayer({ id: "share-song-numbers", type: "symbol", source: "share-songs", layout: { "text-field": ["to-string", ["get", "index"]], "text-size": 13, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#041316", "text-halo-color": "rgba(255,255,255,.18)", "text-halo-width": .5 } });
            }
            const bounds = coordinates.reduce((value, coordinate) => value.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
            if (Math.abs(bounds.getEast() - bounds.getWest()) < .01 && Math.abs(bounds.getNorth() - bounds.getSouth()) < .01) {
              bounds.extend([bounds.getWest() - .02, bounds.getSouth() - .02]);
              bounds.extend([bounds.getEast() + .02, bounds.getNorth() + .02]);
            }
            map.fitBounds(bounds, { padding: 72, duration: 0, maxZoom: 13 });
            map.once("idle", () => {
              try {
                const image = new Image();
                image.onload = () => { clearTimeout(timeout); finish(image); };
                image.onerror = () => { clearTimeout(timeout); finish(null); };
                image.src = map.getCanvas().toDataURL("image/png");
              } catch { clearTimeout(timeout); finish(null); }
            });
          });
          map.on("error", () => {});
        } catch { clearTimeout(timeout); finish(null); }
      });
    }

    function canvasBlob() {
      return new Promise((resolve, reject) => {
        $("shareCardCanvas").toBlob(blob => blob ? resolve(blob) : reject(new Error("JourneyDeck could not create the image.")), "image/png", 1);
      });
    }

    function filename() {
      const title = String(state.shareCardData?.title || "drive").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return `journeydeck-${title || "drive"}.png`;
    }

    async function download() {
      render();
      const blob = await canvasBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename(); anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      $("shareCardMessage").textContent = "Image saved. The PNG contains no raw addresses or geographic coordinates.";
    }

    async function shareToX() {
      render();
      const blob = await canvasBlob();
      const file = new File([blob], filename(), { type: "image/png" });
      const postText = `${state.shareCardData.title}\n${state.shareCardData.startLabel} \u2192 ${state.shareCardData.endLabel}\n${state.shareCardData.stats.miles ?? "--"} miles · ${state.shareCardData.stats.durationMinutes ?? "--"} minutes\n#JourneyDeck`;
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: state.shareCardData.title, text: postText });
        $("shareCardMessage").textContent = "Choose X in the share sheet to post the card.";
      } else {
        await download();
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(postText)}`, "_blank", "noopener,noreferrer,width=700,height=700");
        $("shareCardMessage").textContent = "The PNG was saved and the X composer opened. Attach the saved card to the post.";
      }
    }

    async function open(drive) {
      if (!drive) return;
      const modal = $("shareCardModal");
      modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
      $("shareCardLoading").hidden = false;
      $("shareCardWorkspace").hidden = true;
      $("shareCardMessage").textContent = "";
      try {
        const card = await api.post("/api/drive/share-card", { driveId: drive.id });
        state.shareCardData = card;
        await Promise.all([loadArtwork(card), loadMapArtwork(card)]);
        $("shareCardPrivacy").textContent = card.privacy.note;
        $("shareCardHomeStatus").textContent = card.privacy.homeProtected
          ? "Home replaced with Saginaw, TX"
          : "No Home endpoint detected";
        $("shareCardLoading").hidden = true;
        $("shareCardWorkspace").hidden = false;
        render();
      } catch (error) {
        $("shareCardLoading").textContent = error.message || "JourneyDeck could not create this card.";
      }
    }

    function close() {
      const modal = $("shareCardModal");
      modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
      state.shareCardData = null; artwork = null; mapArtwork = null;
    }

    function bind() {
      $("shareCardButton")?.addEventListener("click", () => open(state.selectedDrive));
      document.querySelectorAll("[data-close-share-card]").forEach(item => item.addEventListener("click", close));
      document.querySelectorAll("[data-share-stat]").forEach(input => input.addEventListener("change", render));
      ["shareCardTheme", "shareCardMapStyle", "shareCardArtwork"].forEach(id => $(id)?.addEventListener("change", render));
      $("shareCardDownload")?.addEventListener("click", () => download().catch(error => { $("shareCardMessage").textContent = error.message; }));
      $("shareCardNativeButton")?.addEventListener("click", () => shareToX().catch(error => {
        if (error?.name !== "AbortError") $("shareCardMessage").textContent = error.message || "Sharing was not available.";
      }));
    }

    return Object.freeze({ open, close, render, download, shareToX, bind });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.shareCards = Object.freeze({ create });
})();
