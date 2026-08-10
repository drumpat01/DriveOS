(function () {
  const $ = window.DriveOSDom.byId;
  const escapeHtml = window.DriveOSDom.escapeHtml;
  const api = window.DriveOSApi;
  let setup = null;

  function currentDestination() {
    return $("siriDestination")?.value || setup?.savedPlaces?.[0]?.label || "Work";
  }

  function currentMood() {
    return $("siriMood")?.value || "focused";
  }

  function shortcutPhrase(label) {
    const value = String(label || "destination").trim().toLowerCase();
    return value === "home" ? "Let's go home" : `Let's go to ${value}`;
  }

  function endpointUrl() {
    if (setup?.endpointUrl) return setup.endpointUrl;
    if (/\.ts\.net$/i.test(location.hostname)) return `${location.origin}${setup?.endpointPath || "/api/shortcuts/prepare"}`;
    return "Open DriveOS through Tailscale on your iPhone to get this URL";
  }

  function requestBody() {
    return JSON.stringify({ placeLabel: currentDestination(), mood: currentMood() }, null, 2);
  }

  function setMessage(message, isError) {
    const node = $("siriSetupMessage");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  function updateBuilder() {
    const phrase = shortcutPhrase(currentDestination());
    if ($("siriPhrase")) $("siriPhrase").textContent = phrase;
    if ($("siriEndpoint")) $("siriEndpoint").value = endpointUrl();
    if ($("siriAccessKey")) $("siriAccessKey").value = setup?.token || "";
    if ($("siriRequestBody")) $("siriRequestBody").value = requestBody();
  }

  function renderSetup() {
    const status = $("siriSetupStatus");
    const workspace = $("siriSetupWorkspace");
    const enable = $("enableSiriShortcuts");
    if (!status || !workspace || !enable) return;

    const enabled = Boolean(setup?.enabled && setup?.token);
    status.classList.toggle("enabled", enabled);
    status.querySelector("strong").textContent = enabled ? "Siri access is enabled" : "Siri access is off";
    status.querySelector("small").textContent = enabled
      ? "Protected by Tailscale and a separate DriveOS access key."
      : "Your Tessie and Spotify credentials stay on this computer.";
    enable.hidden = enabled;
    workspace.hidden = !enabled;

    if (!enabled) return;
    const destination = $("siriDestination");
    const previous = destination.value;
    const places = Array.isArray(setup.savedPlaces) ? setup.savedPlaces : [];
    destination.innerHTML = places.length
      ? places.map(place => `<option value="${escapeHtml(place.label)}">${escapeHtml(place.label)}</option>`).join("")
      : '<option value="">Name a place in Drive Library first</option>';
    destination.disabled = !places.length;
    if (places.some(place => place.label === previous)) destination.value = previous;
    else {
      const work = places.find(place => String(place.label).toLowerCase() === "work");
      if (work) destination.value = work.label;
    }
    updateBuilder();
  }

  async function loadSetup() {
    setMessage("Loading secure Siri settings...");
    try {
      setup = await api.get("/api/shortcuts/setup");
      renderSetup();
      setMessage(setup.enabled ? "Configure the Apple Shortcut below. DriveOS will speak the summary when it finishes." : "Enable Siri access to create a private shortcut key.");
    } catch (error) {
      setMessage(error.message || "Siri settings could not be loaded.", true);
    }
  }

  async function changeSetup(action) {
    if (action === "rotate" && !confirm("Replace the Siri access key? Existing DriveOS shortcuts will stop working until you paste the new key.")) return;
    if (action === "disable" && !confirm("Disable Siri access? Existing DriveOS shortcuts will no longer be able to prepare the car.")) return;
    const buttons = [$("enableSiriShortcuts"), $("rotateSiriKey"), $("disableSiriShortcuts")].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    setMessage(action === "disable" ? "Disabling Siri access..." : "Creating a private Siri access key...");
    try {
      setup = await api.post("/api/shortcuts/setup", { action });
      renderSetup();
      setMessage(action === "disable" ? "Siri access is disabled." : "Siri access is ready. Copy the three values into Apple Shortcuts.");
    } catch (error) {
      setMessage(error.message || "Siri access could not be changed.", true);
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function openSetup() {
    const modal = $("siriSetupModal");
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    loadSetup();
  }

  function closeSetup() {
    const modal = $("siriSetupModal");
    if (!modal?.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    $("openSiriSetup")?.focus();
  }

  async function copyText(kind, button) {
    const values = {
      endpoint: $("siriEndpoint")?.value,
      key: $("siriAccessKey")?.value,
      body: $("siriRequestBody")?.value
    };
    const value = values[kind];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      const original = button.textContent;
      button.textContent = "Copied";
      setMessage(`${kind === "key" ? "Access key" : kind === "endpoint" ? "URL" : "JSON body"} copied.`);
      setTimeout(() => { button.textContent = original; }, 1400);
    } catch (_) {
      setMessage("Copy was blocked. Press and hold the value to copy it manually.", true);
    }
  }

  function initialize() {
    $("openSiriSetup")?.addEventListener("click", openSetup);
    document.querySelectorAll("[data-close-siri-setup]").forEach(button => button.addEventListener("click", closeSetup));
    $("enableSiriShortcuts")?.addEventListener("click", () => changeSetup("enable"));
    $("rotateSiriKey")?.addEventListener("click", () => changeSetup("rotate"));
    $("disableSiriShortcuts")?.addEventListener("click", () => changeSetup("disable"));
    $("siriDestination")?.addEventListener("change", updateBuilder);
    $("siriMood")?.addEventListener("change", updateBuilder);
    $("toggleSiriKey")?.addEventListener("click", event => {
      const input = $("siriAccessKey");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      event.currentTarget.textContent = showing ? "Show" : "Hide";
      event.currentTarget.setAttribute("aria-label", showing ? "Show access key" : "Hide access key");
    });
    document.querySelectorAll("[data-siri-copy]").forEach(button => button.addEventListener("click", () => copyText(button.dataset.siriCopy, button)));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && $("siriSetupModal")?.classList.contains("open")) closeSetup();
    });
  }

  window.DriveOSFeatures = window.DriveOSFeatures || {};
  window.DriveOSFeatures.siriShortcuts = Object.freeze({ initialize });
})();
