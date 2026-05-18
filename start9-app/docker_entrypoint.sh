#!/bin/sh
# Start9 entrypoint. Prepares the wallet volume, then hands off to s6-overlay's
# /init which supervises barkd, the node api, and nginx.
set -e

WALLET_DIR=/data/.bark
mkdir -p "${WALLET_DIR}"
chown -R app:app /data

# Hand off to s6-overlay init. s6 forwards SIGTERM to all longrun services, so
# nginx, the node api, and barkd all get a clean shutdown — barkd flushes its
# SQLite WAL on exit, which keeps backups consistent.
exec /init "$@"
