(function () {
  const $ = window.DriveOSDom.byId;

  function create(tasks) {
    let started = false;
    let initialRefresh = null;

    async function refresh() {
      const button = $("refreshButton");

      if (button) {
        button.disabled = true;
        button.textContent = "Refreshing\u2026";
      }

      try {
        await Promise.allSettled([tasks.loadStatus(), tasks.loadVehicle()]);
        await tasks.loadSpotify();
        await Promise.allSettled([
          tasks.loadDrives(),
          tasks.loadMusicStats(),
          tasks.loadStatistics(),
          tasks.loadPlaces(),
          tasks.loadCharging(),
          tasks.loadRecaps(),
          ...(tasks.loadCommutePlaces ? [tasks.loadCommutePlaces()] : [])
        ]);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Refresh data";
        }
      }
    }

    function bind() {
      $("refreshButton")?.addEventListener("click", refresh);
    }

    function start() {
      if (started) return initialRefresh;
      started = true;
      initialRefresh = refresh();

      window.setInterval(() => {
        tasks.loadVehicle();
        tasks.loadStatus();
      }, 120_000);

      window.setInterval(async () => {
        await tasks.loadSpotify();
        await Promise.allSettled([
          tasks.loadDrives(),
          tasks.loadMusicStats(),
          tasks.loadStatistics(),
          tasks.loadPlaces(),
          tasks.loadCharging(),
          tasks.loadRecaps(),
          ...(tasks.loadCommutePlaces ? [tasks.loadCommutePlaces()] : [])
        ]);
      }, 300_000);

      return initialRefresh;
    }

    return Object.freeze({ refresh, bind, start });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.refresh = Object.freeze({ create });
})();
