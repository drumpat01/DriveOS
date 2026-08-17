(function () {
  const $ = window.DriveOSDom.byId;
  const escapeHtml = window.DriveOSDom.escapeHtml;

  function create({ api, ensureMapLibre, artworkMarkup }) {
    let active = false;
    let vehicleTimer = null;
    let musicTimer = null;
    let requestPending = false;
    let map = null;
    let marker = null;
    let resizeObserver = null;
    let lastVehicle = null;

    const validCoordinate = (value, maximum) => Number.isFinite(Number(value)) && Math.abs(Number(value)) <= maximum;
    const gpsDate = value => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      const date = new Date(numeric > 1e12 ? numeric : numeric * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const headingLabel = value => {
      const heading = Number(value);
      if (!Number.isFinite(heading)) return "--";
      const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      return `${directions[Math.round(heading / 45) % 8]} ${Math.round(heading)}\u00B0`;
    };
    const motionState = vehicle => {
      const speed = Number(vehicle.speedMph);
      if (Number.isFinite(speed) && speed > 0) return "Driving";
      if (String(vehicle.shiftState || "").toUpperCase() === "P") return "Parked";
      return "Stationary";
    };

    function setText(id, value, fallback = "--") {
      const element = $(id);
      if (element) element.textContent = value == null || value === "" ? fallback : String(value);
    }

    function renderVehicle(vehicle) {
      lastVehicle = vehicle;
      const speed = Number(vehicle.speedMph);
      const battery = Number(vehicle.battery);
      const latitude = Number(vehicle.latitude);
      const longitude = Number(vehicle.longitude);
      const hasLocation = validCoordinate(latitude, 90) && validCoordinate(longitude, 180);
      const updated = gpsDate(vehicle.gpsAsOf);
      const status = motionState(vehicle);

      setText("liveDriveVehicle", vehicle.name, "Vehicle");
      setText("liveDriveState", status);
      setText("liveDriveSpeed", Number.isFinite(speed) ? Math.round(speed) : 0);
      setText("liveDriveBattery", Number.isFinite(battery) ? `${Math.round(battery)}%` : "--");
      setText("liveDriveRange", Number.isFinite(Number(vehicle.rangeMiles)) ? `${Math.round(Number(vehicle.rangeMiles))} mi` : "--");
      setText("liveDriveHeading", headingLabel(vehicle.heading));
      setText("liveDriveGear", vehicle.shiftState || (status === "Parked" ? "P" : "--"));
      setText("liveDriveGps", updated ? `GPS ${updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Latest Tessie position");

      const shell = $("liveDriveShell");
      shell?.classList.toggle("is-driving", status === "Driving");
      shell?.classList.toggle("is-parked", status === "Parked");

      if (hasLocation) renderMap(latitude, longitude, vehicle.heading);
      else setMapMessage("Current GPS position unavailable");
    }

    function setMapMessage(message) {
      const container = $("liveDriveMap");
      if (!container || map) return;
      container.innerHTML = `<div class="live-drive-map-message">${escapeHtml(message)}</div>`;
    }

    function renderMap(latitude, longitude, heading) {
      const container = $("liveDriveMap");
      if (!container) return;
      if (!window.maplibregl) {
        setMapMessage("Loading live map\u2026");
        void ensureMapLibre().then(() => {
          if (active && lastVehicle) renderVehicle(lastVehicle);
        }).catch(() => setMapMessage("Live map unavailable"));
        return;
      }

      const coordinates = [longitude, latitude];
      if (!map) {
        container.innerHTML = "";
        map = new maplibregl.Map({
          container,
          style: window.JourneyDeckMapTheme?.style || "https://tiles.openfreemap.org/styles/dark",
          center: coordinates,
          zoom: 15,
          bearing: Number(heading) || 0,
          pitch: 52,
          attributionControl: false,
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false
        });
        window.JourneyDeckMapTheme?.attach(map);
        const markerElement = document.createElement("div");
        markerElement.className = "live-drive-marker";
        markerElement.innerHTML = '<span aria-hidden="true">&#x25B2;</span>';
        marker = new maplibregl.Marker({ element: markerElement, anchor: "center" }).setLngLat(coordinates).addTo(map);
        resizeObserver = new ResizeObserver(() => map?.resize());
        resizeObserver.observe(container);
      } else {
        marker?.setLngLat(coordinates);
        map.easeTo({ center: coordinates, bearing: Number(heading) || 0, duration: 900 });
      }
      marker?.getElement()?.style.setProperty("--vehicle-heading", `${Number(heading) || 0}deg`);
      window.setTimeout(() => map?.resize(), 80);
    }

    function renderMusic(data) {
      const track = (data?.recent || [])[0];
      const container = $("liveDriveMusic");
      if (!container) return;
      if (!track) {
        container.innerHTML = '<div class="live-drive-music-empty">No recent Spotify play</div>';
        return;
      }
      container.innerHTML = `
        ${artworkMarkup(track, "live-drive-artwork")}
        <div><span>RECENTLY PLAYED</span><strong>${escapeHtml(track.track || "Unknown track")}</strong><small>${escapeHtml(track.artist || "Unknown artist")}</small></div>`;
    }

    async function refreshVehicle() {
      if (!active || document.hidden || requestPending) return;
      requestPending = true;
      try {
        const vehicle = await api.get("/api/vehicle/live");
        renderVehicle(vehicle);
        setText("liveDriveConnection", "LIVE");
      } catch (error) {
        setText("liveDriveConnection", "RECONNECTING");
        setText("liveDriveGps", error.message || "Vehicle unavailable");
      } finally {
        requestPending = false;
      }
    }

    async function refreshMusic() {
      if (!active || document.hidden) return;
      try { renderMusic(await api.get("/api/spotify/recent")); } catch {}
    }

    function start() {
      if (active) return;
      active = true;
      setText("liveDriveConnection", "CONNECTING");
      void refreshVehicle();
      void refreshMusic();
      vehicleTimer = window.setInterval(refreshVehicle, 10_000);
      musicTimer = window.setInterval(refreshMusic, 30_000);
      window.setTimeout(() => map?.resize(), 120);
    }

    function stop() {
      active = false;
      window.clearInterval(vehicleTimer);
      window.clearInterval(musicTimer);
      vehicleTimer = null;
      musicTimer = null;
      setText("liveDriveConnection", "PAUSED");
    }

    function bind() {
      document.addEventListener("journeydeck:viewchange", event => {
        if (event.detail?.view === "live") start();
        else stop();
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && location.hash === "#live") void refreshVehicle();
      });
      $("liveDriveRefresh")?.addEventListener("click", () => {
        void refreshVehicle();
        void refreshMusic();
      });
    }

    return Object.freeze({ bind, start, stop });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.liveDrive = Object.freeze({ create });
})();
