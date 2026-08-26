#!/usr/bin/env bash
set -euo pipefail

# Build multi-arch images (amd64 + arm64) for the three Umbrel services
# and push to Docker Hub under the configured org.

ORG="${DOCKER_ORG:-secondark}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
VERSION=$(node -p "require('./package.json').version")

# Load barkd checksums + version.
if [ -f docker/checksums.env ]; then
  # shellcheck disable=SC1091
  set -a; source docker/checksums.env; set +a
fi
BARK_VERSION="${BARK_VERSION:-0.6.2}"
BARKD_SHA256_AMD64="${BARKD_SHA256_AMD64:-}"
BARKD_SHA256_ARM64="${BARKD_SHA256_ARM64:-}"

if [ -z "${BARKD_SHA256_AMD64}" ] || [ -z "${BARKD_SHA256_ARM64}" ]; then
  echo "ERROR: barkd checksums missing. Fill docker/checksums.env before publishing." >&2
  exit 1
fi

if ! docker buildx inspect bark-builder >/dev/null 2>&1; then
  docker buildx create --name bark-builder --use
else
  docker buildx use bark-builder
fi

echo "==> Building ${ORG}/bark-web:${VERSION}"
docker buildx build \
  --platform "${PLATFORMS}" \
  --tag "${ORG}/bark-web:${VERSION}" \
  --file docker/bark-web.Dockerfile \
  --output type=registry \
  .

echo "==> Building ${ORG}/bark-web-api:${VERSION}"
docker buildx build \
  --platform "${PLATFORMS}" \
  --tag "${ORG}/bark-web-api:${VERSION}" \
  --file docker/bark-web-api.Dockerfile \
  --output type=registry \
  .

echo "==> Building ${ORG}/barkd:${BARK_VERSION}"
docker buildx build \
  --platform "${PLATFORMS}" \
  --build-arg "BARK_VERSION=${BARK_VERSION}" \
  --build-arg "BARKD_SHA256_AMD64=${BARKD_SHA256_AMD64}" \
  --build-arg "BARKD_SHA256_ARM64=${BARKD_SHA256_ARM64}" \
  --tag "${ORG}/barkd:${BARK_VERSION}" \
  --file docker/barkd.Dockerfile \
  --output type=registry \
  .

echo "Done. Next: npm run umbrel:digests"
