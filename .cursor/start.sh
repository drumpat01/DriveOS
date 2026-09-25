#!/usr/bin/env bash
# Per-boot readiness reconciliation for JourneyDeck Cloud Agents.
# Ensures the Node 24 shims and seeded development database exist even when a
# pod boots from a build without re-running install. Idempotent and terminates.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
  if nvm ls 24 >/dev/null 2>&1; then
    NODE_BIN_DIR="$(dirname "$(nvm which 24)")"
    SHIM_DIR="/usr/local/cargo/bin"
    if [ -d "${SHIM_DIR}" ] && [ -w "${SHIM_DIR}" ]; then
      for bin in node npm npx; do
        ln -sf "${NODE_BIN_DIR}/${bin}" "${SHIM_DIR}/${bin}"
      done
    fi
    export PATH="${SHIM_DIR}:${NODE_BIN_DIR}:${PATH}"
    hash -r
  fi
fi

# Recreate the local development database if it is missing (e.g. a fresh clone
# where data/ was never populated). Safe no-op when it already exists.
if [ ! -f "data/atlas-node-dev/driveos.db" ]; then
  npm run seed:atlas || echo "seed:atlas failed; the app server will rebuild an empty snapshot." >&2
fi

echo "JourneyDeck start reconciliation complete."
