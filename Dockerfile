FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

ENV DRIVEOS_MODE=web
ENV DRIVEOS_DATA_DIR=/app/data
ENV DRIVEOS_REPOSITORY_PROVIDER=SQLite

EXPOSE 10000

CMD ["pwsh", "-NoLogo", "-NoProfile", "-File", "./DriveOS-Server.ps1"]