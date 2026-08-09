(function () {
  async function request(path, options) {
    const response = await fetch(path, { cache: "no-store", ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }
  window.DriveOSApi = {
    get(path) { return request(path); },
    post(path, body) {
      return request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    }
  };
})();
