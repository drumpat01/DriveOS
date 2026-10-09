#!/usr/bin/env bash
set -euo pipefail

PUBLIC_PORT="${PORT:-10000}"
BACKEND_PORT="${DRIVEOS_COMPATIBILITY_PORT:-10001}"

# The live beta keeps its own frontend while securely forwarding authenticated
# API requests to the production JourneyDeck backend. Credentials remain in the
# production service and are never copied into the beta environment.
if [[ "${DRIVEOS_BETA_LIVE_PROXY:-false}" == "true" ]]; then
    export DRIVEOS_BETA_PORT="${PUBLIC_PORT}"
    export DRIVEOS_BETA_HOST="0.0.0.0"
    exec node ./tools/beta-live-proxy.mjs
fi

# Optional isolated visual mode using only fictional repository demo data.
if [[ "${DRIVEOS_BETA_DEMO:-false}" == "true" ]]; then
    export DRIVEOS_TEST_PORT="${PUBLIC_PORT}"
    export DRIVEOS_TEST_HOST="0.0.0.0"
    exec node ./tests/mock-web-server.mjs
fi

# Node is the only public process. Atlas refresh runs in-process after listen
# and again when the snapshot is stale. PowerShell starts only when a
# compatibility route needs it, so idle and public traffic stay on one runtime.
export DRIVEOS_NODE_HOST="0.0.0.0"
export DRIVEOS_NODE_PORT="${PUBLIC_PORT}"
export DRIVEOS_NODE_LEGACY_UPSTREAM="http://127.0.0.1:${BACKEND_PORT}"
export DRIVEOS_NODE_LEGACY_READ_ONLY="false"
export DRIVEOS_NODE_SESSION_SECRET="${DRIVEOS_AUTH_SECRET:-}"
export DRIVEOS_COMPATIBILITY_LAZY="${DRIVEOS_COMPATIBILITY_LAZY:-true}"
export DRIVEOS_COMPATIBILITY_PORT="${BACKEND_PORT}"
export DRIVEOS_ATLAS_INLINE_REBUILD="${DRIVEOS_ATLAS_INLINE_REBUILD:-true}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=288}"
exec node ./server/dist/index.js
