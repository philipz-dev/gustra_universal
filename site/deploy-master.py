#!/usr/bin/env python3
"""Upload the Gustra master index (overview of all subsites) to https://gustra.net/master/ via FTP.

Uploads site/master/index.html → public_html/master/index.html.
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
    ("master/index.html", "master/index.html"),
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
        for rel, remote_rel in FILES:
            src = BASE / rel
            if not src.exists():
                print(f"  SKIP (missing locally): {rel}")
                continue
            ftp.cwd("/")
            ensure_dir(ftp, f"{REMOTE_ROOT}/{Path(remote_rel).parent}")
            with src.open("rb") as fh:
                ftp.storbinary(f"STOR {Path(remote_rel).name}", fh)
            print(f"  uploaded {rel} ({src.stat().st_size} bytes)")
    print("OK — https://gustra.net/master/")


if __name__ == "__main__":
    main()
