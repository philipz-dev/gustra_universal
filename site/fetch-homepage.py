#!/usr/bin/env python3
"""Fetch the live gustra.net homepage HTML via FTP into ./index.html with a timestamped backup."""
from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime, timezone
from ftplib import FTP
from pathlib import Path

HOST = "da039.site.eu"
USER = "ysnl39dbaf"
REMOTE_DIR = "domains/gustra.net/public_html"
OUT = Path(__file__).resolve().parent / "index.html"
BACKUP_DIR = Path(__file__).resolve().parent / "backups"


def password() -> str:
    try:
        out = subprocess.check_output(
            ["security", "find-internet-password", "-s", HOST, "-a", USER, "-w"],
            text=True,
        ).strip()
        if out:
            return out
    except Exception:
        pass
    raise SystemExit("No FTP password found in Keychain")


def main() -> None:
    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=60) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        for part in REMOTE_DIR.split("/"):
            ftp.cwd(part)
        data = bytearray()
        ftp.retrbinary("RETR index.html", data.extend)
    current = bytes(data)
    print(f"Fetched {len(current)} bytes from {REMOTE_DIR}/index.html")

    # Keep first-time backup only if it does not exist yet (idempotent on rerun).
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"index-{stamp}.html"
    backup.write_bytes(current)
    print(f"Backup saved → {backup.relative_to(Path.home())}")

    OUT.write_bytes(current)
    print(f"Homepage saved → {OUT}")


if __name__ == "__main__":
    main()
