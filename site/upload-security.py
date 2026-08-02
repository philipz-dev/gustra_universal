#!/usr/bin/env python3
"""Upload the Gustra security guide to https://gustra.net/security/ via FTP.

Uploads site/security/index.html → public_html/security/index.html and the
shared stylesheet site/css/styles.css → public_html/css/styles.css (so the
page keeps the house style if that css changed too).
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
    ("security/index.html", "security/index.html"),
    ("css/styles.css", "css/styles.css"),
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
    print("OK — https://gustra.net/security/")


if __name__ == "__main__":
    main()
