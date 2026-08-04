#!/usr/bin/env bash
# Thin wrapper → interactive deploy (iOS). Dry-run by default; pass --go to publish.
# Runs the shared build-sync guard first (see deploy-store.sh header).
exec bash "$(cd "$(dirname "$0")" && pwd)/deploy-store.sh" --platform ios "$@"
