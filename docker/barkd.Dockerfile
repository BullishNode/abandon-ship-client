FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 barkd

WORKDIR /app

ARG BARK_VERSION
ARG TARGETARCH
ARG BARKD_SHA256_AMD64
ARG BARKD_SHA256_ARM64

RUN case "${TARGETARCH}" in \
      amd64) ARCH="x86_64"; SHA="${BARKD_SHA256_AMD64}" ;; \
      arm64) ARCH="arm64";  SHA="${BARKD_SHA256_ARM64}" ;; \
      *)     echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    curl -fsSL "https://gitlab.com/ark-bitcoin/bark/-/releases/bark-${BARK_VERSION}/downloads/barkd-${BARK_VERSION}-linux-${ARCH}" -o barkd && \
    if [ -n "${SHA}" ]; then \
      echo "${SHA}  barkd" | sha256sum -c -; \
    else \
      echo "WARNING: barkd checksum not provided — supply BARKD_SHA256_AMD64/ARM64 build-args for verified builds."; \
    fi && \
    chmod +x barkd

RUN mkdir -p /data && chown -R barkd:barkd /data

USER barkd

EXPOSE 4000

CMD ["./barkd", "--port", "4000", "--host", "0.0.0.0", "--datadir", "/data/.bark"]
