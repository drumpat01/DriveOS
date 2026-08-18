(() => {
  const form = document.getElementById("loginForm");
  const panel = document.querySelector("main");
  const button = document.getElementById("submitButton");
  const message = document.getElementById("message");
  const password = document.getElementById("password");
  const passwordToggle = document.getElementById("passwordToggle");
  const rememberMe = document.getElementById("rememberMe");
  const passkeyButton = document.getElementById("passkeyButton");
  const installButton = document.getElementById("installButton");
  const privacyButton = document.getElementById("privacyButton");
  const privacyDialog = document.getElementById("privacyDialog");
  const installDialog = document.getElementById("installDialog");
  let installPrompt = null;

  const decode = value => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), character => character.charCodeAt(0));
  const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function setBusy(busy, label = "Signing in…") {
    panel.classList.toggle("is-authenticating", busy);
    button.disabled = busy;
    passkeyButton.disabled = busy;
    passwordToggle.disabled = busy;
    rememberMe.disabled = busy;
    button.textContent = busy ? label : "Sign in";
  }

  passwordToggle.addEventListener("click", () => {
    const reveal = password.type === "password";
    password.type = reveal ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(reveal));
    passwordToggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    password.focus({ preventScroll: true });
    const end = password.value.length;
    password.setSelectionRange(end, end);
  });

  privacyButton.addEventListener("click", () => privacyDialog.showModal());
  document.querySelectorAll("[data-close-dialog]").forEach(closeButton => closeButton.addEventListener("click", () => document.getElementById(closeButton.dataset.closeDialog)?.close()));
  [privacyDialog, installDialog].forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" }).catch(() => {}), { once: true });
  }
  if (!isStandalone && isIos) installButton.hidden = false;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if (!isStandalone) installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) {
      installDialog.showModal();
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });

  // Passkeys are bound to the exact production origin. Local and Tailscale
  // previews use password authentication and do not advertise a broken flow.
  if (window.PublicKeyCredential && navigator.credentials && location.hostname === "journeydeck.me") passkeyButton.hidden = false;
  passkeyButton.addEventListener("click", async () => {
    message.textContent = "";
    setBusy(true, "Verifying…");
    try {
      const optionResponse = await fetch("/api/auth/passkey/options", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      const options = await optionResponse.json();
      if (!options.available) {
        message.textContent = "Sign in with your password, then enable Face ID in Data Health.";
        return;
      }
      const credential = await navigator.credentials.get({ publicKey: { challenge: decode(options.challenge), rpId: options.rpId, allowCredentials: [{ type: "public-key", id: decode(options.credentialId) }], userVerification: "required", timeout: 60000 } });
      const response = await fetch("/api/auth/passkey/verify", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: options.challengeId, credentialId: encode(credential.rawId), clientDataJSON: encode(credential.response.clientDataJSON), authenticatorData: encode(credential.response.authenticatorData), signature: encode(credential.response.signature) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Passkey sign-in failed.");
      window.location.replace("/");
    } catch (error) {
      if (error?.name !== "NotAllowedError") message.textContent = error.message || "Passkey sign-in failed.";
    } finally {
      setBusy(false);
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "";
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value,
          rememberMe: rememberMe.checked
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        message.textContent = data.error || "Sign in failed. Please try again.";
        return;
      }
      form.password.value = "";
      window.location.replace(data.role === "wife" ? "/wife" : "/");
    } catch {
      message.textContent = "JourneyDeck could not be reached. Please try again.";
    } finally {
      setBusy(false);
    }
  });
})();
