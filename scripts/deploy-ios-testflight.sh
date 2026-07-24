#!/usr/bin/env bash
# Thin wrapper → interactive deploy (iOS). Dry-run by default; pass --go to publish.
exec bash "$(cd "$(dirname "$0")" && pwd)/deploy-store.sh" --platform ios "$@"
