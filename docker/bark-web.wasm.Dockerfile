FROM docker.io/node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json* ./api/
RUN npm ci
COPY . .

# WASM-mode config is baked into the bundle at build time (vite `define`).
# .env files are excluded from the build context (.dockerignore), so these
# build args are the only config source. Defaults target signet — a mainnet
# deployment must override all three explicitly.
ARG BARK_NETWORK=signet
ARG ARK_SERVER=https://ark.signet.2nd.dev
ARG CHAIN_SOURCE=https://esplora.signet.2nd.dev
ENV BARK_NETWORK=${BARK_NETWORK} \
    ARK_SERVER=${ARK_SERVER} \
    CHAIN_SOURCE=${CHAIN_SOURCE}

# Refuse to bake a mainnet bundle that still points at signet infrastructure.
RUN if [ "${BARK_NETWORK}" = "mainnet" ] && { echo "${ARK_SERVER}${CHAIN_SOURCE}" | grep -q "signet"; }; then \
      echo "ERROR: BARK_NETWORK=mainnet but ARK_SERVER/CHAIN_SOURCE point at signet." >&2; \
      exit 1; \
    fi && \
    echo "Building WASM bundle: network=${BARK_NETWORK} ark=${ARK_SERVER} chain=${CHAIN_SOURCE}"

RUN npm run build:wasm

FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Template is rendered by the image's entrypoint (envsubst) so nginx listens
# on Railway's injected $PORT; 8080 is the fallback for local runs.
COPY docker/nginx.wasm.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080
