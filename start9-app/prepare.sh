#!/usr/bin/env bash
# Prepare a Debian/Ubuntu environment for building the bark-web s9pk.
# Run this on the build host before `make`.
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

${SUDO} apt-get update
${SUDO} apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg lsb-release make build-essential git

# Docker + buildx.
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | ${SUDO} sh
fi

# Enable buildx (bundled with modern Docker).
docker buildx version >/dev/null || {
  echo "docker buildx not available — install docker-buildx-plugin manually." >&2
  exit 1
}

# qemu binfmt handlers so buildx can cross-build the aarch64 image on amd64.
${SUDO} docker run --privileged --rm tonistiigi/binfmt --install arm64

# Rust toolchain for start-sdk.
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
fi
. "${HOME}/.cargo/env"

# start-sdk from the Start9 repo, pinned to the 0.3.5.x release the manifest
# format targets — master has moved on to the next SDK generation. There is no
# standalone start-sdk crate; core/install-sdk.sh builds the startbox binary
# and symlinks start-sdk/start-cli to it. Rust is pinned to 1.78 — the locked
# time-0.3.30 dep fails type inference (E0282) on rustc >= 1.80.
SDK_RUST_VERSION=1.78.0
if ! command -v start-sdk >/dev/null 2>&1; then
  rustup toolchain install "${SDK_RUST_VERSION}"
  SDK_TMP="$(mktemp -d)"
  git clone --depth 1 --branch v0.3.5.1 --recurse-submodules \
    https://github.com/Start9Labs/start-os.git "${SDK_TMP}/start-os"
  # GIT_HASH.txt is normally emitted by the root Makefile; the startos crate
  # include_str!s it at compile time.
  git -C "${SDK_TMP}/start-os" rev-parse HEAD > "${SDK_TMP}/start-os/GIT_HASH.txt"
  (cd "${SDK_TMP}/start-os/core" && RUSTUP_TOOLCHAIN="${SDK_RUST_VERSION}" ./install-sdk.sh)
  rm -rf "${SDK_TMP}"
fi

echo "Build env ready. Run 'make' from start9-app/."
