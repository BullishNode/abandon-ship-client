#!/usr/bin/env bash
# Build the bark-web s9pk for Start9.
#
# Requires: docker buildx, start-sdk, make.
# Run start9-app/prepare.sh once on a fresh Debian/Ubuntu host to install those.
set -euo pipefail

cd "$(dirname "$0")/.."

# Sanity-check tooling early.
for cmd in docker make start-sdk; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required tool: ${cmd}" >&2
    echo "Run start9-app/prepare.sh on a Debian/Ubuntu host first." >&2
    exit 1
  fi
done

cd start9-app
make all
echo
echo "Built: $(pwd)/bark-web.s9pk"
