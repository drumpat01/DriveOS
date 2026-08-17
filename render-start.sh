#!/usr/bin/env bash
set -euo pipefail

PUBLIC_PORT="${PORT:-10000}"
BACKEND_PORT="10001"

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
