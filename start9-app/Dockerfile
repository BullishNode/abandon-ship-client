# Single-image Start9 build. Three processes (barkd, node api, nginx) under s6-overlay.
# Mirrors the Umbrel multi-container layout collapsed into one image.

# ---- SPA build ----
FROM node:22-alpine AS spa-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json* ./api/
RUN npm ci
COPY . .
RUN npm run build

# ---- API build ----
FROM node:22-alpine AS api-builder
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN npm ci
COPY api ./
RUN npm run build

# ---- API runtime deps (prod only) ----
FROM node:22-alpine AS api-prod-deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN npm ci --omit=dev

# ---- barkd binary fetch ----
FROM debian:bookworm-slim AS barkd-fetch
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
ARG BARK_VERSION=0.2.1
ARG TARGETARCH
ARG BARKD_SHA256_AMD64=43e777de5613b74a0bc1cfb8508c1d8976c89c68904858f0cf0db2f567907cd2
ARG BARKD_SHA256_ARM64=3e898ccb8b30f27481cfa3ff9b2132f5723e28adb8f1d1fc687d47414f289af5
WORKDIR /out
RUN case "${TARGETARCH}" in \
      amd64) ARCH="x86_64"; SHA="${BARKD_SHA256_AMD64}" ;; \
      arm64) ARCH="arm64";  SHA="${BARKD_SHA256_ARM64}" ;; \
      *)     echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    curl -fsSL "https://gitlab.com/ark-bitcoin/bark/-/releases/bark-${BARK_VERSION}/downloads/barkd-${BARK_VERSION}-linux-${ARCH}" -o barkd && \
    echo "${SHA}  barkd" | sha256sum -c - && \
    chmod +x barkd

# ---- Final runtime ----
FROM debian:bookworm-slim

ARG S6_OVERLAY_VERSION=3.2.0.2

# System deps: nginx, node (for api), s6-overlay, curl/xz to fetch the overlay tarball, tini as PID 1.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils nginx tini \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 --shell /bin/bash app

# Install s6-overlay v3.
RUN ARCH="$(uname -m)" && \
    curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" \
      | tar -C / -Jxpf - && \
    curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${ARCH}.tar.xz" \
      | tar -C / -Jxpf -

# Lay out app dirs.
RUN mkdir -p /app/web /app/api /data && chown -R app:app /data

# SPA static assets.
COPY --from=spa-builder /app/dist /app/web

# API: prod deps + built JS.
COPY --from=api-prod-deps /app/api/node_modules /app/api/node_modules
COPY --from=api-prod-deps /app/api/package.json /app/api/package.json
COPY --from=api-builder /app/api/dist /app/api/dist

# barkd binary.
COPY --from=barkd-fetch /out/barkd /usr/local/bin/barkd

# nginx config + s6 service tree + entrypoint.
COPY start9-app/nginx.conf /etc/nginx/sites-available/bark-web
COPY start9-app/s6 /etc/s6-overlay/s6-rc.d
COPY start9-app/docker_entrypoint.sh /usr/local/bin/docker_entrypoint.sh

RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/bark-web /etc/nginx/sites-enabled/bark-web && \
    chmod +x /usr/local/bin/docker_entrypoint.sh && \
    # s6 run scripts lose their exec bit on Windows hosts — set it explicitly.
    chmod +x /etc/s6-overlay/s6-rc.d/barkd/run \
             /etc/s6-overlay/s6-rc.d/api/run \
             /etc/s6-overlay/s6-rc.d/nginx/run && \
    # Register services in user bundle so s6-rc starts them.
    mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/barkd && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/api && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/nginx && \
    # nginx runtime dirs.
    mkdir -p /var/lib/nginx /var/log/nginx /run/nginx

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker_entrypoint.sh"]
