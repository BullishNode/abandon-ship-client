#!/usr/bin/env bash
set -euo pipefail

# Bump BARK_VERSION across all env/Dockerfile/script defaults and refresh
# pinned SHA-256 checksums by downloading the upstream release binaries.
#
# Usage: scripts/bump-bark-version.sh <version>
# Example: scripts/bump-bark-version.sh 0.2.1

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

NEW_VERSION="$1"
BASE_URL="https://gitlab.com/ark-bitcoin/bark/-/releases/bark-${NEW_VERSION}/downloads"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "==> Downloading barkd ${NEW_VERSION} binaries"
curl -fsSL -o "${TMPDIR}/barkd-amd64" "${BASE_URL}/barkd-${NEW_VERSION}-linux-x86_64"
curl -fsSL -o "${TMPDIR}/barkd-arm64" "${BASE_URL}/barkd-${NEW_VERSION}-linux-arm64"

SHA_AMD64="$(sha256sum "${TMPDIR}/barkd-amd64" | awk '{print $1}')"
SHA_ARM64="$(sha256sum "${TMPDIR}/barkd-arm64" | awk '{print $1}')"

echo "    amd64: ${SHA_AMD64}"
echo "    arm64: ${SHA_ARM64}"

# Detect sed in-place flag (GNU vs BSD).
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')
fi

replace() {
  local file="$1" pattern="$2" replacement="$3"
  if [ ! -f "$file" ]; then
    echo "    skip (missing): $file"
    return
  fi
  sed "${SED_INPLACE[@]}" -E "s|${pattern}|${replacement}|g" "$file"
  echo "    updated: $file"
}

echo "==> Updating BARK_VERSION + checksums"

# Env files: BARK_VERSION=<x>, BARKD_SHA256_*=<hex>
for f in .env.signet .env.mainnet .env.example docker/checksums.env; do
  replace "$f" "^BARK_VERSION=.*"        "BARK_VERSION=${NEW_VERSION}"
  replace "$f" "^BARKD_SHA256_AMD64=.*"  "BARKD_SHA256_AMD64=${SHA_AMD64}"
  replace "$f" "^BARKD_SHA256_ARM64=.*"  "BARKD_SHA256_ARM64=${SHA_ARM64}"
done

# .env.example keeps SHAs blank by convention.
replace .env.example "^BARKD_SHA256_AMD64=.*" "BARKD_SHA256_AMD64="
replace .env.example "^BARKD_SHA256_ARM64=.*" "BARKD_SHA256_ARM64="

# start9-app/Dockerfile: ARG defaults
replace start9-app/Dockerfile \
  "^ARG BARK_VERSION=.*"        "ARG BARK_VERSION=${NEW_VERSION}"
replace start9-app/Dockerfile \
  "^ARG BARKD_SHA256_AMD64=.*"  "ARG BARKD_SHA256_AMD64=${SHA_AMD64}"
replace start9-app/Dockerfile \
  "^ARG BARKD_SHA256_ARM64=.*"  "ARG BARKD_SHA256_ARM64=${SHA_ARM64}"

# docker-compose.yml fallback default
replace docker-compose.yml \
  "BARK_VERSION: \\\$\\{BARK_VERSION:-[^}]*\\}" \
  "BARK_VERSION: \${BARK_VERSION:-${NEW_VERSION}}"

# Script fallback defaults
for f in scripts/umbrel-build.sh scripts/umbrel-digests.sh; do
  replace "$f" \
    "BARK_VERSION=\"\\\$\\{BARK_VERSION:-[^}]*\\}\"" \
    "BARK_VERSION=\"\${BARK_VERSION:-${NEW_VERSION}}\""
done

echo "==> Done. Review with: git diff"
