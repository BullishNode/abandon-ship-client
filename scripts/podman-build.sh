#!/usr/bin/env bash
set -euo pipefail

# Build multi-arch container images for bark-web and bark-web-api using
# podman, producing a single manifest list per image. Optionally pushes
# to a registry (Docker Hub by default).
#
# Usage:
#   scripts/podman-build.sh             # build local manifests only
#   scripts/podman-build.sh --push      # build and push to ${REGISTRY}
#
# Env overrides:
#   REGISTRY   registry host                 (default: docker.io)
#   DOCKER_ORG org/namespace on the registry (default: secondark)
#   PLATFORMS  comma-separated platforms     (default: linux/amd64,linux/arm64)
#   TAG        image tag                     (default: package.json version)
#
# Cross-arch builds rely on qemu/binfmt being registered on the host. On
# Debian/Ubuntu: `sudo apt-get install qemu-user-static`. On Fedora/RHEL:
# `sudo dnf install qemu-user-static`. Alternatively:
#   podman run --rm --privileged docker.io/tonistiigi/binfmt --install all

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

if [ ! -f package.json ]; then
  echo "ERROR: package.json not found in ${REPO_ROOT}." >&2
  echo "       The script expects to live in <repo>/scripts/. If you copied it into a" >&2
  echo "       container, make sure the rest of the repo is in the same parent directory." >&2
  exit 1
fi

REGISTRY="${REGISTRY:-docker.io}"
ORG="${DOCKER_ORG:-secondark}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

# Read version from package.json without depending on node/jq — the builder
# image used by CI may not have either installed.
read_pkg_version() {
  if command -v node >/dev/null 2>&1; then
    node -p "require('./package.json').version"
  elif command -v jq >/dev/null 2>&1; then
    jq -r .version package.json
  else
    sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' package.json | head -n1
  fi
}
TAG="${TAG:-$(read_pkg_version)}"

if [ -z "${TAG}" ]; then
  echo "ERROR: could not determine image tag from package.json; pass TAG=... explicitly." >&2
  exit 1
fi

PUSH=false
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    -h|--help)
      sed -n '3,21p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v podman >/dev/null 2>&1; then
  echo "ERROR: podman is required but not installed." >&2
  exit 1
fi

# When this script runs inside another container (CI builder images, etc.)
# the default isolation tries to create a new mount namespace, which requires
# CAP_SYS_ADMIN on the host — usually missing, surfacing as
# `mount 'proc' to 'proc': Operation not permitted`.
# Chroot isolation skips that and works in unprivileged nested builds.
ISOLATION="${BUILDAH_ISOLATION:-chroot}"
export BUILDAH_ISOLATION="${ISOLATION}"
export STORAGE_DRIVER="${STORAGE_DRIVER:-vfs}"

build_image() {
  local name="$1"
  local dockerfile="$2"
  local ref="${REGISTRY}/${ORG}/${name}:${TAG}"

  echo "==> Building ${ref} for ${PLATFORMS}"

  # Drop any stale manifest of the same name so the build starts clean.
  podman manifest rm "${ref}" >/dev/null 2>&1 || true

  podman build \
    --isolation "${ISOLATION}" \
    --platform "${PLATFORMS}" \
    --manifest "${ref}" \
    --file "${dockerfile}" \
    .

  if [ "${PUSH}" = true ]; then
    echo "==> Pushing ${ref}"
    podman manifest push --all "${ref}" "docker://${ref}"
  fi
}

build_image "bark-web"     "docker/bark-web.Dockerfile"
build_image "bark-web-api" "docker/bark-web-api.Dockerfile"

echo
echo "Done."
if [ "${PUSH}" = false ]; then
  echo "Local manifests:"
  echo "  ${REGISTRY}/${ORG}/bark-web:${TAG}"
  echo "  ${REGISTRY}/${ORG}/bark-web-api:${TAG}"
  echo "Re-run with --push to publish."
fi
