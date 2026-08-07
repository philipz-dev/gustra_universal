#!/usr/bin/env python3
"""Run the i18n locale check and, only if it passes, deploy the
localization table to https://gustra.net/localization/.

The check regenerates localization/index.html from i18n/locales/*.json on
success; this script then uploads that table (deploy-localization.py also
rebuilds it defensively before uploading). If the check fails, nothing is
deployed and the exit code stays 1.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "scripts" / "check-i18n.py"
DEPLOY = ROOT / "scripts" / "deploy-localization.py"


def main() -> int:
    print("==> i18n check (regenerates localization/index.html on success)")
    check = subprocess.run([sys.executable, "-u", str(CHECK)], cwd=ROOT)
    if check.returncode != 0:
        print("\nERROR: i18n check failed — NOT deploying. Fix the locales first.",
              file=sys.stderr)
        return check.returncode

    print("\n==> Deploying localization table to gustra.net/localization/")
    deploy = subprocess.run([sys.executable, "-u", str(DEPLOY)], cwd=ROOT)
    if deploy.returncode != 0:
        print("\nERROR: localization deploy failed.", file=sys.stderr)
        return deploy.returncode

    print("\nOK — i18n check passed and https://gustra.net/localization/ is live.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
