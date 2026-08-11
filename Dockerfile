FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

ENV DRIVEOS_MODE=web
ENV DRIVEOS_DATA_DIR=/tmp/driveos
ENV DRIVEOS_REPOSITORY_PROVIDER=Turso

EXPOSE 10000

RUN chmod +x /app/render-start.sh

CMD ["/app/render-start.sh"]