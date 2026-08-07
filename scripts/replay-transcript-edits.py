#!/usr/bin/env python3
"""Replay transcript StrReplace edits onto the current worktree.

Reads the agent transcript, extracts every StrReplace for paths under the
repo root, and applies them in chronological order (as they happened) to the
current files. Safe: each old_string must match exactly once; if a match fails
the script reports it and continues, so nothing is corrupted.

Usage: python3 scripts/replay-transcript-edits.py [--dry-run]
"""
from __future__ import annotations

import json
import os
import re
import sys

REPO = "/Users/philipzvar/gustra_universal"
TRANSCRIPT = (
    "/Users/philipzvar/.cursor/projects/Users-philipzvar-gustra-universal/"
    "agent-transcripts/77580108-f735-454e-be5b-b0d1b508c82a/"
    "77580108-f735-454e-be5b-b0d1b508c82a.jsonl"
)

DRY = "--dry-run" in sys.argv

# Only replay the app files (not the huge site HTML edits, which are separate
# and already present in the worktree via earlier deploys). Filter by prefix.
PREFIXES = (
    "app/",
    "components/",
    "hooks/",
    "i18n/locales/",
    "scripts/check-i18n.py",
    "package.json",
    ".cursor/rules/",
)


def main() -> None:
    edits: dict[str, list[dict]] = {}
    with open(TRANSCRIPT, encoding="utf-8") as f:
        for line in f:
            try:
                ev = json.loads(line)
            except Exception:
                continue
            if ev.get("role") != "assistant":
                continue
            msg = ev.get("message", {})
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            for c in content:
                if not isinstance(c, dict):
                    continue
                if c.get("type") != "tool_use" or c.get("name") != "StrReplace":
                    continue
                inp = c.get("input", {})
                p = inp.get("path", "")
                if not p.startswith(REPO + "/"):
                    continue
                rel = p[len(REPO) + 1:]
                if not any(rel.startswith(pre) for pre in PREFIXES):
                    continue
                old = inp.get("old_string", "")
                new = inp.get("new_string", "")
                if not old or old == new:
                    continue
                edits.setdefault(rel, []).append({"old": old, "new": new})

    total_ok = total_fail = 0
    for rel, ops in sorted(edits.items()):
        path = os.path.join(REPO, rel)
        if not os.path.exists(path):
            print(f"SKIP (missing): {rel}")
            continue
        with open(path, encoding="utf-8") as fh:
            content = fh.read()
        orig = content
        failed = []
        for op in ops:
            old, new = op["old"], op["new"]
            if content.count(old) != 1:
                failed.append(old[:60])
                continue
            content = content.replace(old, new, 1)
        if content != orig:
            print(f"  ✓ {rel}: {len(ops)} edits, {len(failed)} mismatches")
            if not DRY:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(content)
            total_ok += 1
        else:
            print(f"  · {rel}: geen verandering (al toegepast of mismatches: {len(failed)})")
            total_fail += len(failed)
        for fl in failed:
            print(f"      MISMATCH: {fl!r}")

    print(f"\nTotaal: {total_ok} bestanden bijgewerkt, {total_fail} mismatches.")
    if DRY:
        print("(--dry-run: niets geschreven)")


if __name__ == "__main__":
    main()
