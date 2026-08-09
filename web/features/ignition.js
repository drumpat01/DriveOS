(function () {
  const { byId } = window.DriveOSDom;
  const READY_TIMEOUT_MS = 20_000;
  let startupReady = Promise.resolve();
  let running = null;

  function delay(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
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
    }, 420);
    window.setTimeout(() => ignition.remove(), 1100);
  }

  function run() {
    if (running) return running;

    const ignition = byId("driveosIgnition");
    if (!ignition) return Promise.resolve();

    const status = byId("ignitionSystemText");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const minimumDuration = reduced ? 320 : 1820;
    document.body.classList.add("ignition-active");

    if (reduced) {
      updateStatus(status, "LOADING DRIVE AND MUSIC DATA");
    } else {
      [
        [480, "LINKING VEHICLE TELEMETRY"],
        [920, "MAPPING DRIVE MEMORY"],
        [1360, "REFRESHING MUSIC ARTWORK"]
      ].forEach(([wait, message]) => {
        window.setTimeout(() => updateStatus(status, message), wait);
      });
    }

    const readyOrTimeout = Promise.race([
      startupReady,
      delay(READY_TIMEOUT_MS).then(() => {
        console.warn("DriveOS startup refresh timed out; continuing with available data.");
      })
    ]);

    running = Promise.all([delay(minimumDuration), readyOrTimeout]).then(() => {
      updateStatus(status, "VEHICLE INTELLIGENCE ONLINE");
      finish(ignition);
    });

    return running;
  }

  window.DriveOSIgnition = Object.freeze({ run, setReady });
  window.runDriveOSIgnition = run;
})();
