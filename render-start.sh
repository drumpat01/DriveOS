#!/usr/bin/env bash
set -euo pipefail

PUBLIC_PORT="${PORT:-10000}"
BACKEND_PORT="10001"
COMPATIBILITY_READY_FILE="${DRIVEOS_COMPATIBILITY_READY_FILE:-/tmp/driveos/compatibility.ready}"

if [[ "${DRIVEOS_ATLAS_NODE_CANARY:-false}" == "true" ]]; then
    export PORT="${BACKEND_PORT}"
    export DRIVEOS_COMPATIBILITY_READY_FILE="${COMPATIBILITY_READY_FILE}"
    mkdir -p "$(dirname "${COMPATIBILITY_READY_FILE}")"
    rm -f "${COMPATIBILITY_READY_FILE}"
    (
        set +e
        LEGACY_CHILD=""
        trap 'rm -f "${COMPATIBILITY_READY_FILE}"; [[ -n "${LEGACY_CHILD}" ]] && kill "${LEGACY_CHILD}" 2>/dev/null || true; exit 0' INT TERM
        while true; do
            rm -f "${COMPATIBILITY_READY_FILE}"
            pwsh -NoLogo -NoProfile -File ./DriveOS-Server.ps1 &
            LEGACY_CHILD=$!
            if node ./server/dist/wait-for-compatibility.js; then
                : > "${COMPATIBILITY_READY_FILE}"
            else
                echo "JourneyDeck compatibility server failed its readiness gate; restarting it." >&2
                kill "${LEGACY_CHILD}" 2>/dev/null || true
            fi
            LEGACY_EXIT=0
            wait "${LEGACY_CHILD}" || LEGACY_EXIT=$?
            rm -f "${COMPATIBILITY_READY_FILE}"
            echo "JourneyDeck compatibility server exited with status ${LEGACY_EXIT}; restarting in 2 seconds." >&2
            sleep 2
        done
    ) &
    LEGACY_PID=$!
    trap 'kill "${LEGACY_PID}" 2>/dev/null || true' EXIT INT TERM

    export DRIVEOS_NODE_HOST="0.0.0.0"
    export DRIVEOS_NODE_PORT="${PUBLIC_PORT}"
    export DRIVEOS_NODE_LEGACY_UPSTREAM="http://127.0.0.1:${BACKEND_PORT}"
    export DRIVEOS_NODE_LEGACY_READ_ONLY="false"
    export DRIVEOS_NODE_SESSION_SECRET="${DRIVEOS_AUTH_SECRET:-}"
    # Do not start the public Node listener until the PowerShell compatibility
    # boundary has returned consecutive successful application-level probes.
    # Render keeps the previous stateless revision live during this gate.
    node ./server/dist/wait-for-compatibility.js
    node ./server/dist/refresh-hosted-snapshot.js
    (
        while true; do
            sleep "${DRIVEOS_ATLAS_REFRESH_SECONDS:-900}"
            node ./server/dist/refresh-hosted-snapshot.js || echo "Atlas source refresh failed; retaining the last valid snapshot." >&2
        done
    ) &
    REFRESH_PID=$!
    trap 'kill "${LEGACY_PID}" "${REFRESH_PID}" 2>/dev/null || true' EXIT INT TERM
    exec node ./server/dist/index.js
fi

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

cat > /etc/nginx/nginx.conf <<EOF
events {}

http {
    access_log /dev/stdout;
    error_log /dev/stderr warn;

    server {
        listen 0.0.0.0:${PUBLIC_PORT};
        server_name _;
        # Attachment JSON contains base64, which is larger than the original
        # file. DriveOS still enforces a 1.5 MB decoded attachment limit.
        client_max_body_size 4m;

        # Render's health check must never wait behind DriveOS's
        # single-request PowerShell backend.
        location = /healthz {
            access_log off;
            default_type text/plain;
            return 200 "ok\n";
        }

        location / {
            proxy_pass http://127.0.0.1:${BACKEND_PORT};
            proxy_http_version 1.1;
            proxy_set_header Host \$http_host;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
EOF

nginx -t
nginx

# Render's public port now belongs to nginx. DriveOS listens only on the
# internal backend port, while nginx answers /healthz immediately.
export PORT="${BACKEND_PORT}"

exec pwsh -NoLogo -NoProfile -File ./DriveOS-Server.ps1
