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
        // First wave: the two panels users perceive as the dashboard itself.
        // Both are fast after the backend optimization pass.
        await Promise.allSettled([
          tasks.loadVehicle(),
          tasks.loadDrives()
        ]);

        mark("driveos-critical-ready");
        await afterPaint();

        // Second wave: fill the large music panel, then connection/status UI.
        // Start Spotify first so it gets first chance at the serial backend.
        const spotifyPromise = tasks.loadSpotify();
        const statusPromise = tasks.loadStatus();
        const spotifyResult = await Promise.resolve(spotifyPromise)
          .then(value => ({ status: "fulfilled", value }))
          .catch(reason => ({ status: "rejected", reason }));

        await Promise.allSettled([statusPromise]);
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
          await tasks.loadDrives();
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