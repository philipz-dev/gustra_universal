#!/usr/bin/env python3
"""Upload the Gustra control audit to https://gustra.net/controls/ via FTP.

Uploads site/controls/* → public_html/controls/ (index.html, save-controls.php,
controls-state.json) so visitors can tick each button behaviour as OK and leave
a remark, synced to the server like the plan site.
"""
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
    "save-controls.php",
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
    for part in rel.split("/"):
        if part in ("", "."):
            continue
        try:
            ftp.cwd(part)
        except Exception:
            ftp.mkd(part)
            ftp.cwd(part)


def main() -> None:
    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=120) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        ftp.cwd("/")
        ensure_dir(ftp, f"{REMOTE_ROOT}/controls")
        for name in FILES:
            src = BASE / name
            if not src.exists():
                print(f"  SKIP (missing locally): {name}")
                continue
            with src.open("rb") as fh:
                ftp.storbinary(f"STOR {name}", fh)
            print(f"  uploaded {name} ({src.stat().st_size} bytes)")
    print("OK — https://gustra.net/controls/")


if __name__ == "__main__":
    main()
