#!/usr/bin/env python3
"""Regenerate GUSTRA_UNIVERSAL_FULL.txt — concatenated source dump for the project."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "GUSTRA_UNIVERSAL_FULL.txt"

SKIP_DIR_NAMES = {
    ".git",
    ".expo",
    "node_modules",
    "android",
    "ios",
    "dist",
    "web-build",
    ".kotlin",
    "coverage",
    "__pycache__",
    ".cursor",
    "roadmap",
    "assets",  # images/fonts — not useful in text dump
}

SKIP_FILE_NAMES = {
    "GUSTRA_UNIVERSAL_FULL.txt",
    "package-lock.json",
    ".DS_Store",
}

INCLUDE_SUFFIXES = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".txt",
    ".mjs",
    ".cjs",
    ".css",
}

ALLOWED_DOT_DIRS = {".claude", ".vscode"}
ALLOWED_DOT_FILES = {".gitignore", ".env.example"}


def is_skipped_dir(name: str) -> bool:
    if name in SKIP_DIR_NAMES:
        return True
    if name.startswith(".") and name not in ALLOWED_DOT_DIRS:
        return True
    return False


def should_include_file(path: Path) -> bool:
    if path.name in SKIP_FILE_NAMES:
        return False
    if path.name.startswith(".") and path.name not in ALLOWED_DOT_FILES:
        # allow files inside .vscode / .claude
        if not any(p in ALLOWED_DOT_DIRS for p in path.relative_to(ROOT).parts[:-1]):
            return False
    if path.stat().st_size > 1_500_000:
        return False
    if path.suffix.lower() in INCLUDE_SUFFIXES:
        return True
    if path.name.endswith(".config.ts") or path.name.endswith(".config.js"):
        return True
    return False


def iter_files() -> list[Path]:
    files: list[Path] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(ROOT).parts
        if any(is_skipped_dir(part) for part in rel_parts[:-1]):
            continue
        if should_include_file(path):
            files.append(path)
    return files


def main() -> None:
    files = iter_files()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    chunks: list[str] = [
        "=" * 80,
        "Gustra Universal — full project dump",
        f"Generated: {stamp}",
        f"Root: {ROOT}",
        f"Files: {len(files)}",
        "=" * 80,
        "",
    ]
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        chunks.append("=" * 80)
        chunks.append(f"FILE: {rel}")
        chunks.append("=" * 80)
        chunks.append(text.rstrip() + "\n")
        chunks.append("")

    OUT.write_text("\n".join(chunks) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(files)} files, {OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
