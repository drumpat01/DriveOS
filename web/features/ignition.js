(function () {
  const { byId } = window.DriveOSDom;
  const SOFT_READY_TIMEOUT_MS = 900;
  let startupReady = Promise.resolve();
  let running = null;

  function delay(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  function mark(name) {
    try {
      window.performance?.mark?.(name);
    } catch {}
  }

  function setReady(readiness) {
    startupReady = Promise.resolve(readiness).catch(error => {
      console.error("DriveOS startup refresh failed:", error);
    });
  }

  function updateStatus(status, message) {
    if (!status || !document.body.contains(status)) return;
    status.classList.remove("ignition-system-text-swap");
    void status.offsetWidth;
    status.textContent = message;
    status.classList.add("ignition-system-text-swap");
  }

  function finish(ignition) {
    ignition.classList.add("ignition-ready");

    window.setTimeout(() => {
      ignition.classList.add("ignition-complete");
      document.body.classList.remove("ignition-active");
      mark("driveos-ignition-visible");
    }, 180);

    window.setTimeout(() => ignition.remove(), 520);
  }

  function run() {
    if (running) return running;

    const ignition = byId("driveosIgnition");
    if (!ignition) return Promise.resolve();

    const status = byId("ignitionSystemText");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const minimumDuration = reduced ? 180 : 520;
    const readyTimeout = reduced ? 450 : SOFT_READY_TIMEOUT_MS;

    document.body.classList.add("ignition-active");

    if (reduced) {
      updateStatus(status, "LOADING DRIVE AND MUSIC DATA");
    } else {
      [
        [180, "LINKING VEHICLE TELEMETRY"],
        [420, "MAPPING DRIVE MEMORY"],
        [700, "REFRESHING MUSIC ARTWORK"]
      ].forEach(([wait, message]) => {
        window.setTimeout(() => updateStatus(status, message), wait);
      });
    }

    // The app now renders useful dashboard data progressively. Do not keep
    // the full-screen ignition layer up while secondary views finish loading.
    const readyOrSoftTimeout = Promise.race([
      startupReady,
      delay(readyTimeout)
    ]);

    running = Promise.all([
      delay(minimumDuration),
      readyOrSoftTimeout
    ]).then(() => {
      updateStatus(status, "VEHICLE INTELLIGENCE ONLINE");
      finish(ignition);
    });

    return running;
  }

  window.DriveOSIgnition = Object.freeze({ run, setReady });
  window.runDriveOSIgnition = run;
})();