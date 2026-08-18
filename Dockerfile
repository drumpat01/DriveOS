FROM node:24-bookworm-slim AS node-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server ./server
COPY src ./src
COPY web ./web
RUN npm run build:server

FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates nginx \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node-build /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

COPY . .
COPY --from=node-build /app/node_modules ./node_modules
COPY --from=node-build /app/server/dist ./server/dist

ENV DRIVEOS_MODE=web
ENV DRIVEOS_DATA_DIR=/tmp/driveos
ENV DRIVEOS_REPOSITORY_PROVIDER=Turso

EXPOSE 10000

RUN chmod +x /app/render-start.sh

CMD ["/app/render-start.sh"]
