#!/usr/bin/env bash
set -euo pipefail

# Fetch multi-arch index digests for the three published images and write
# the fully-qualified refs to .umbrel-digests. Run after umbrel-build.sh.

ORG="${DOCKER_ORG:-secondark}"
VERSION=$(node -p "require('./package.json').version")

if [ -f docker/checksums.env ]; then
  # shellcheck disable=SC1091
  set -a; source docker/checksums.env; set +a
fi
BARK_VERSION="${BARK_VERSION:-0.7.0}"

REFS=(
  "bark-web:${VERSION}"
  "bark-web-api:${VERSION}"
  "barkd:${BARK_VERSION}"
)

: > .umbrel-digests
for ref in "${REFS[@]}"; do
  full="${ORG}/${ref}"
  digest=$(docker buildx imagetools inspect "${full}" \
    --format '{{json .Manifest}}' | jq -r '.digest')
  if [ -z "${digest}" ] || [ "${digest}" = "null" ]; then
    echo "ERROR: failed to fetch digest for ${full}" >&2
    exit 1
  fi
  echo "${full}@${digest}" | tee -a .umbrel-digests
done

echo "Done. Next: npm run umbrel:sync-compose"
