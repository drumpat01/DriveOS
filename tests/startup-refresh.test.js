const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const calls = [];
const button = { addEventListener() {} };
const context = {
  console,
  Promise,
  setTimeout,
  clearTimeout,
  setInterval: () => 1,
  clearInterval,
  document: { body: { contains: () => true, classList: { add() {}, remove() {} } } },
  window: null
};
context.window = context;
context.DriveOSDom = { byId: id => id === "refreshButton" ? button : null };
context.matchMedia = () => ({ matches: false });
vm.createContext(context);

for (const file of ["web/features/refresh.js", "web/features/ignition.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const task = name => async () => { calls.push(name); };
const refresh = context.DriveOSFeatures.refresh.create({
  loadStatus: task("status"),
  loadVehicle: task("vehicle"),
  loadSpotify: task("spotify"),
  loadDrives: task("drives"),
  loadMusicStats: task("music"),
  loadStatistics: task("statistics"),
  loadPlaces: task("places"),
  loadCharging: task("charging"),
  loadRecaps: task("recaps")
});

const first = refresh.start();
assert.strictEqual(refresh.start(), first, "startup refresh should run only once");
assert.equal(typeof context.DriveOSIgnition.setReady, "function");
context.DriveOSIgnition.setReady(first);

first.then(() => {
  const spotify = calls.indexOf("spotify");
  assert.ok(spotify >= 0, "Spotify refresh should run at startup");
  for (const dependent of ["drives", "music", "statistics", "places", "charging", "recaps"]) {
    assert.ok(calls.indexOf(dependent) > spotify, `${dependent} should load after Spotify`);
  }
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Refresh data");
  console.log("Startup refresh readiness tests passed.");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
