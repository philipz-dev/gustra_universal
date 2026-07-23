#!/usr/bin/env python3
"""Export Expo web (static) and upload to https://gustra.net/webversion/."""
from __future__ import annotations

import re
import subprocess
import sys
from ftplib import FTP, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
CREDS = Path.home() / "Desktop" / "credentials.txt"
HOST = "da039.site.eu"
USER = "ysnl39dbaf"
REMOTE_DIR = "domains/gustra.net/public_html/webversion"


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


def ensure_cwd(ftp: FTP, remote_dir: str) -> None:
    ftp.cwd("/")
    for part in remote_dir.split("/"):
        if not part:
            continue
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def ensure_subdir(ftp: FTP, rel: Path) -> None:
    """cwd into rel under current dir, creating as needed; leave cwd there."""
    for part in rel.parts:
        if part in ("", "."):
            continue
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def upload_tree(ftp: FTP, local_root: Path) -> int:
    """Upload all files under local_root into current FTP cwd. Returns file count."""
    count = 0
    base = ftp.pwd()
    for path in sorted(local_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(local_root)
        ftp.cwd(base)
        if rel.parent != Path("."):
            ensure_subdir(ftp, rel.parent)
        with path.open("rb") as fh:
            ftp.storbinary(f"STOR {rel.name}", fh)
        count += 1
        print(f"  uploaded {rel} ({path.stat().st_size} bytes)")
    ftp.cwd(base)
    return count


def export_web() -> None:
    print("Exporting web static build …")
    subprocess.check_call(
        ["npx", "expo", "export", "--platform", "web", "--clear"],
        cwd=ROOT,
    )
    if not DIST.is_dir() or not any(DIST.iterdir()):
        raise SystemExit(f"Export produced no files in {DIST}")
    write_htaccess()
    materialize_clean_urls()


def write_htaccess() -> None:
    (DIST / ".htaccess").write_text(
        "DirectoryIndex index.html\n\n"
        "<IfModule mod_rewrite.c>\n"
        "  RewriteEngine On\n"
        "  RewriteBase /webversion/\n\n"
        "  RewriteCond %{REQUEST_FILENAME} -f [OR]\n"
        "  RewriteCond %{REQUEST_FILENAME} -d\n"
        "  RewriteRule ^ - [L]\n\n"
        "  RewriteRule ^([^.]+?)/?$ $1.html [L]\n"
        "</IfModule>\n",
        encoding="utf-8",
    )
    print("wrote dist/.htaccess")


def materialize_clean_urls() -> None:
    """Copy route.html → route/index.html so /webversion/map works without rewrite."""
    skip = {"index.html", "+not-found.html", "_sitemap.html"}
    n = 0
    for html in sorted(DIST.glob("*.html")):
        if html.name in skip or "[" in html.name:
            continue
        stem = html.stem
        dest_dir = DIST / stem
        dest_dir.mkdir(exist_ok=True)
        dest = dest_dir / "index.html"
        dest.write_bytes(html.read_bytes())
        n += 1
    print(f"materialized {n} clean URL folders")


def main() -> None:
    do_export = "--skip-export" not in sys.argv
    if do_export:
        export_web()
    elif not DIST.is_dir():
        raise SystemExit(f"No {DIST}; run without --skip-export")

    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=120) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        ensure_cwd(ftp, REMOTE_DIR)
        print("cwd →", ftp.pwd())
        n = upload_tree(ftp, DIST)
    print(f"OK — {n} files → https://gustra.net/webversion/")


if __name__ == "__main__":
    main()
