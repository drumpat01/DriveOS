(function () {
  const $ = window.DriveOSDom.byId;

  function mark(name) {
    try {
      window.performance?.mark?.(name);
    } catch {}
  }

  function afterPaint() {
    return new Promise(resolve => {
      const raf = window.requestAnimationFrame ||
        (callback => window.setTimeout(callback, 0));

      raf(() => raf(resolve));
    });
  }

  function whenIdle(timeout = 500) {
    return new Promise(resolve => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => resolve(), { timeout });
        return;
      }

      window.setTimeout(resolve, Math.min(timeout, 80));
    });
  }

  function create(tasks) {
    let started = false;
    let initialRefresh = null;
    let refreshPromise = null;
    let backgroundSyncPending = false;

    function scheduleListeningSync() {
      if (!tasks.syncListeningHistory || backgroundSyncPending) return;
      backgroundSyncPending = true;

      const run = async () => {
        try {
          if (!document.hidden) {
            await tasks.syncListeningHistory();
          }
        } finally {
          backgroundSyncPending = false;
        }
      };

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => void run(), { timeout: 1800 });
      } else {
        window.setTimeout(() => void run(), 700);
      }
    }

    async function performRefresh({ initial = false } = {}) {
      const button = $("refreshButton");

      if (button) {
        button.disabled = true;
        button.textContent = "Refreshing\u2026";
      }

      if (initial) {
        mark("driveos-startup-begin");
      }

      try {
        // First wave: only the truly critical live shell. Do not make cold
        // historical drive construction part of "critical ready".
        const vehiclePromise = Promise.resolve(tasks.loadVehicle())
          .finally(() => mark("driveos-vehicle-ready"));

        const statusPromise = Promise.resolve(tasks.loadStatus())
          .finally(() => mark("driveos-status-ready"));

        await Promise.allSettled([
          vehiclePromise,
          statusPromise
        ]);

        mark("driveos-critical-ready");
        await afterPaint();

        // Main-content wave: paint a tiny recent-drive payload before touching
        // the 730-day library. This is the dashboard path users actually see.
        await Promise.resolve(tasks.loadDashboardDrives())
          .finally(() => mark("driveos-drives-ready"));

        await afterPaint();

        const spotifyResult = await Promise.resolve(tasks.loadSpotify())
          .then(value => {
            mark("driveos-spotify-ready");
            return { status: "fulfilled", value };
          }, reason => {
            mark("driveos-spotify-ready");
            return { status: "rejected", reason };
          });

        mark("driveos-primary-ready");

        // If Spotify just archived new plays, rematch drives once. The backend
        // invalidates its converted-drive cache when listening history changes.
        const spotifyData = spotifyResult.status === "fulfilled"
          ? spotifyResult.value
          : null;
        const newlyArchived = Number(
          spotifyData?.spotifyNewlyAdded ?? spotifyData?.newlyArchived
        ) || 0;

        if (newlyArchived > 0) {
          await tasks.loadDashboardDrives();
          mark("driveos-drives-ready");
        }

        // Give the browser a clean paint before filling views that are usually
        // offscreen at startup.
        await afterPaint();
        await whenIdle(initial ? 650 : 180);

        await Promise.allSettled([
          tasks.loadMusicStats(),
          tasks.loadStatistics(),
          tasks.loadPlaces(),
          tasks.loadCharging(),
          tasks.loadRecaps()
        ]);

        mark("driveos-secondary-ready");

        // Statistics/recaps normally populate the expensive 730-day backend
        // cache during the secondary wave. Materialize the full client library
        // only now, or sooner if the user opens the Drives tab.
        await tasks.loadDrives();
        mark("driveos-library-ready");

        // Last.fm can be comparatively expensive. Run it only after every
        // visible/secondary panel has finished and the browser is idle.
        scheduleListeningSync();
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Refresh data";
        }
      }
    }

    function refresh() {
      if (refreshPromise) return refreshPromise;

      refreshPromise = performRefresh()
        .finally(() => {
          refreshPromise = null;
        });

      return refreshPromise;
    }

    function bind() {
      $("refreshButton")?.addEventListener("click", refresh);
    }

    function start() {
      if (started) return initialRefresh;
      started = true;

      initialRefresh = performRefresh({ initial: true });

      window.setInterval(() => {
        if (document.hidden) return;
        void tasks.loadVehicle();
        void tasks.loadStatus();
      }, 120_000);

      window.setInterval(() => {
        if (document.hidden || refreshPromise) return;

        refreshPromise = performRefresh()
          .finally(() => {
            refreshPromise = null;
          });
      }, 300_000);

      return initialRefresh;
    }

    return Object.freeze({ refresh, bind, start });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.refresh = Object.freeze({ create });
})();
