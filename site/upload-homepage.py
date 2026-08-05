#!/usr/bin/env python3
"""Upload updated Gustra homepage (root index.html) + assets to gustra.net via FTP."""
from __future__ import annotations

import subprocess
from ftplib import FTP
from pathlib import Path

HOST = "da039.site.eu"
USER = "ysnl39dbaf"
REMOTE_ROOT = "domains/gustra.net/public_html"
BASE = Path(__file__).resolve().parent

FILES = [
    "index.html",
    "css/styles.css",
    "assets/screenshots/screenshot-feed.png",
    "assets/screenshots/screenshot-wine.png",
    "assets/screenshots/screenshot-review.png",
    "assets/screenshots/screenshot-passport.png",
    "assets/screenshots/screenshot-map.png",
    "assets/screenshots/screenshot-timeline.png",
    "assets/screenshots/screenshot-friends.png",
]


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


def ensure_dir(ftp: FTP, rel: str) -> None:
    if not rel:
        return
    for part in rel.split("/"):
        ftp.cwd(part)


def main() -> None:
    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=120) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        for rel in FILES:
            src = BASE / rel
            if not src.exists():
                print(f"  SKIP (missing locally): {rel}")
                continue
            # go to remote root
            ftp.cwd("/")
            ensure_dir(ftp, REMOTE_ROOT)
            # ensure parent dirs
            parent = Path(rel).parent
            if str(parent) != ".":
                ensure_dir(ftp, str(parent))  # relative from REMOTE_ROOT
            with src.open("rb") as fh:
                ftp.storbinary(f"STOR {Path(rel).name}", fh)
            print(f"  uploaded {rel} ({src.stat().st_size} bytes)")
    print("OK — homepage updated")


if __name__ == "__main__":
    main()
