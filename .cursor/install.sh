#!/usr/bin/env bash
# Cloud Agent environment bootstrap for JourneyDeck.
# Idempotent: safe to run repeatedly and against cached/partially prepared state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# 1. Node.js 24 (required: the server relies on the built-in node:sqlite module,
#    which is only stable on Node >= 24; package.json engines pins ">=24.0.0").
#
# The Cloud Agent base image ships Node 22 and prepends an internal `node` shim
# (/exec-daemon/node) ahead of most of PATH. `/usr/local/cargo/bin` sorts before
# that shim, so we point Node 24 symlinks there to make `node` resolve to 24 in
# every shell (install, start, terminals, and interactive agent sessions).
# ---------------------------------------------------------------------------
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
else
  echo "nvm not found at ${NVM_DIR}; cannot provision Node 24." >&2
  exit 1
fi

if ! nvm ls 24 >/dev/null 2>&1; then
  nvm install 24
fi
nvm alias default 24 >/dev/null
NODE_BIN_DIR="$(dirname "$(nvm which 24)")"

SHIM_DIR="/usr/local/cargo/bin"
if [ -d "${SHIM_DIR}" ] && [ -w "${SHIM_DIR}" ]; then
  for bin in node npm npx; do
    ln -sf "${NODE_BIN_DIR}/${bin}" "${SHIM_DIR}/${bin}"
  done
fi
export PATH="${SHIM_DIR}:${NODE_BIN_DIR}:${PATH}"
hash -r
echo "Using Node $(node -v) / npm $(npm -v)"

# ---------------------------------------------------------------------------
# 2. Project dependencies and server build.
# ---------------------------------------------------------------------------
npm ci
npm run build:server

# ---------------------------------------------------------------------------
# 3. Seed the local-first SQLite development database from privacy-safe
#    fictional fixtures so the app server and Atlas benchmark are runnable
#    immediately. Writes only to the git-ignored data/ directory. seed:atlas
#    refuses to overwrite an existing database, so only run it when absent
#    (keeps this install script idempotent).
# ---------------------------------------------------------------------------
if [ ! -f "data/atlas-node-dev/driveos.db" ]; then
  npm run seed:atlas
else
  echo "Development database already present; skipping seed:atlas."
fi

# ---------------------------------------------------------------------------
# 4. Playwright Chromium for the E2E smoke suite. Install the system libraries
#    with sudo (idempotent apt), then the browser as the current user so the
#    test runner finds it under ~/.cache/ms-playwright.
# ---------------------------------------------------------------------------
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo "$(command -v npx)" --yes playwright install-deps chromium || \
    echo "playwright install-deps failed; E2E browser libraries may be incomplete." >&2
fi
npx --yes playwright install chromium

echo "JourneyDeck Cloud Agent environment ready."
