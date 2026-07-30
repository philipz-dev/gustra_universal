#!/usr/bin/env python3
"""Remove obsolete public_html folders (webversion, adriaan) from gustra.net."""
from __future__ import annotations

import re
import subprocess
from ftplib import FTP, error_perm
from pathlib import Path

CREDS = Path.home() / "Desktop" / "credentials.txt"
HOST = "da039.site.eu"
USER = "ysnl39dbaf"
ROOT = "domains/gustra.net/public_html"
FOLDERS = ("webversion", "adriaan")


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
    raise SystemExit("No FTP password found")


def ensure_cwd(ftp: FTP, remote_dir: str) -> None:
    ftp.cwd("/")
    for part in remote_dir.split("/"):
        if not part:
            continue
        ftp.cwd(part)


def clear_dir(ftp: FTP) -> int:
    """Delete all files/subdirs in current cwd. Returns deleted file count."""
    deleted = 0
    names: list[str] = []
    ftp.retrlines("NLST", names.append)
    here = ftp.pwd()
    for name in names:
        base = name.rsplit("/", 1)[-1]
        if base in (".", ".."):
            continue
        try:
            ftp.cwd(base)
            ftp.cwd(here)
            # directory
            ftp.cwd(base)
            deleted += clear_dir(ftp)
            ftp.cwd(here)
            try:
                ftp.rmd(base)
                print(f"  rmdir {here}/{base}")
            except error_perm as e:
                print(f"  rmdir skip {base}: {e}")
        except error_perm:
            try:
                ftp.delete(base)
                deleted += 1
                print(f"  delete {here}/{base}")
            except error_perm as e:
                print(f"  delete skip {base}: {e}")
    return deleted


def main() -> None:
    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=120) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        for folder in FOLDERS:
            path = f"{ROOT}/{folder}"
            print(f"Clearing {path} …")
            try:
                ensure_cwd(ftp, path)
            except error_perm:
                print(f"  (missing — skip)")
                continue
            n = clear_dir(ftp)
            ensure_cwd(ftp, ROOT)
            try:
                ftp.rmd(folder)
                print(f"  removed folder {folder} ({n} files)")
            except error_perm as e:
                print(f"  folder {folder} left (cleared {n} files): {e}")
    print("OK — obsolete folders cleared")


if __name__ == "__main__":
    main()
