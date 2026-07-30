#!/usr/bin/env python3
"""Upload privacy policy to https://gustra.net/privacy/"""
from __future__ import annotations

import re
import subprocess
from ftplib import FTP
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL = ROOT / "privacy"
CREDS = Path.home() / "Desktop" / "credentials.txt"
HOST = "da039.site.eu"
USER = "ysnl39dbaf"
REMOTE_DIR = "domains/gustra.net/public_html/privacy"


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
    text = CREDS.read_text(encoding="utf-8")
    for line in text.splitlines():
        if m := re.match(r"(Paswoord|Password):\s*(.+)$", line.strip(), re.I):
            return m.group(2).strip()
    raise SystemExit("No FTP password found in Keychain or credentials.txt")


def main() -> None:
    path = LOCAL / "index.html"
    if not path.is_file():
        raise SystemExit(f"Missing {path}")
    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=30) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        for part in REMOTE_DIR.split("/"):
            try:
                ftp.cwd(part)
            except Exception:
                ftp.mkd(part)
                ftp.cwd(part)
        print("cwd →", ftp.pwd())
        with path.open("rb") as fh:
            ftp.storbinary("STOR index.html", fh)
        print(f"uploaded index.html ({path.stat().st_size} bytes)")
    print("OK — https://gustra.net/privacy/")


if __name__ == "__main__":
    main()
