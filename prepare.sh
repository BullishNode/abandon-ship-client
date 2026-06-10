#!/usr/bin/env bash
# Root-level shim so the Start9 submission build pipeline (which expects
# `prepare.sh` and `make` at the wrapper repo root) finds them. Delegates to
# the real script in start9-app/.
exec bash "$(dirname "$0")/start9-app/prepare.sh" "$@"
