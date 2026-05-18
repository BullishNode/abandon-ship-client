#!/usr/bin/env bash
set -euo pipefail

# Read .umbrel-digests and rewrite image: lines in umbrel-app/docker-compose.yml.
# Requires yq (Mike Farah's Go version): https://github.com/mikefarah/yq

COMPOSE=umbrel-app/docker-compose.yml
DIGESTS=.umbrel-digests

if [ ! -f "${DIGESTS}" ]; then
  echo "ERROR: ${DIGESTS} not found. Run npm run umbrel:digests first." >&2
  exit 1
fi

if ! command -v yq >/dev/null 2>&1; then
  echo "ERROR: yq not found. Install from https://github.com/mikefarah/yq" >&2
  exit 1
fi

while read -r ref; do
  [ -z "${ref}" ] && continue
  ref_no_digest="${ref%@*}"
  name="${ref_no_digest##*/}"
  image_name="${name%%:*}"
  case "${image_name}" in
    bark-web)     yq -i ".services.web.image   = \"${ref}\"" "${COMPOSE}" ;;
    bark-web-api) yq -i ".services.api.image   = \"${ref}\"" "${COMPOSE}" ;;
    barkd)        yq -i ".services.barkd.image = \"${ref}\"" "${COMPOSE}" ;;
    *) echo "WARNING: unknown image ${image_name}, skipping" ;;
  esac
done < "${DIGESTS}"

echo "Synced ${COMPOSE} with pinned digests."
