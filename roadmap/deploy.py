#!/usr/bin/env python3
"""Upload Gustra plan site to https://gustra.net/plan/ (index.html). Never touches site index.html."""
from __future__ import annotations

import re
import subprocess
from ftplib import FTP
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL = ROOT / "plan"
CREDS = Path.home() / "Desktop" / "credentials.txt"
HOST = "da039.site.eu"
USER = "ysnl39dbaf"
REMOTE_DIR = "domains/gustra.net/public_html/plan"


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
    pw = password()
    state = LOCAL / "plan-state.json"
    if not state.exists():
        state.write_text('{"checked":{},"sections":[],"updatedAt":null}\n', encoding="utf-8")

    files = ["index.html", "save-plan.php", "plan-state.json"]
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=30) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        # ensure remote dir
        for part in REMOTE_DIR.split("/"):
            try:
                ftp.cwd(part)
            except Exception:
                ftp.mkd(part)
                ftp.cwd(part)
        print("cwd →", ftp.pwd())
        for name in files:
            path = LOCAL / name
            with path.open("rb") as fh:
                ftp.storbinary(f"STOR {name}", fh)
            print(f"uploaded {name} ({path.stat().st_size} bytes)")
    print("OK — https://gustra.net/plan/")


if __name__ == "__main__":
    main()
