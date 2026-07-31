#!/usr/bin/env python3
"""Verify Gustra locale files stay complete across all languages.

Checks:
1. Key parity — every locale has exactly the same keys as en.json
2. Placeholder parity — {{vars}} match English for each key
3. Leftover English — flags strings still identical to EN (allowlisted)

Exit 0 on success, 1 on failure.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = ROOT / "i18n" / "locales"
LANGS = ("nl", "fr", "es", "de", "it")
PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

# Strings that may intentionally match English (brands, endonyms, shared UI).
ALLOW_IDENTICAL_VALUES = {
    "OK",
    "N/A",
    "Cover",
    "Gustra",
    "Google",
    "Gemini",
    "Waze",
    "Expo Go",
    "Google Maps",
    "Google Maps SDK",
    "Places API",
    "System",
    "Nederlands",
    "English",
    "Italiano",
    "Deutsch",
    "Español",
    "Français",
    "Service",
    "Cocktail",
    # Common cognates / loanwords identical in several UI locales
    "Restaurant",
    "Perfect",
    "Filters",
    "Filter",
    "Photos",
    "Options",
    "Destination",
    "Alcohol",
    "Error",
    "Password",
    "Scan",
    "Import",
    "OK",
    "Rosé",
    "Draft",
}

# Keys that may keep the English value even when not in ALLOW_IDENTICAL_VALUES.
ALLOW_IDENTICAL_KEYS = {
    "directions.googleMaps",
    "directions.waze",
    "directions.destination",
    "settings.mapsSdk",
    "settings.placesApi",
    "settings.photos",
    "settings.swiftScan.photos",
    "settings.languageDutch",
    "settings.languageEnglish",
    "settings.languageItalian",
    "settings.languageGerman",
    "settings.languageSpanish",
    "settings.languageFrench",
    "settings.languageValueDutch",
    "settings.languageValueEnglish",
    "settings.languageValueItalian",
    "settings.languageValueGerman",
    "settings.languageValueSpanish",
    "settings.languageValueFrench",
    "settings.languageValueSystem",
    "settings.languageSystem",
    "forms.review.photos",
    "forms.review.photoStrip.cover",
    "detail.options.title",
    "detail.options.a11y",
    "detail.restaurant.title",
    "a11y.filters",
    "filters.filters",
    "rating.labels.perfect",
    "wineScan.fiche.alcohol",
    "wineScan.fiche.typeStyles.rose",
    "wineScan.thinking",
    "wineScan.scanAction",
    "backup.password",
    "common.ok",
    "common.no",
    "common.error",
    "rating.labels.na",
    "rating.labels.okay",
    "criteria.service",
    "setup.criteria.tip",
    "reviews.draftLabel",
}


def flatten(obj: object, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    if not isinstance(obj, dict):
        raise TypeError(f"Expected object at {prefix or '<root>'}")
    for key, value in obj.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            out.update(flatten(value, path))
        elif isinstance(value, str):
            out[path] = value
        else:
            raise TypeError(f"Non-string leaf at {path}: {type(value).__name__}")
    return out


def placeholders(text: str) -> list[str]:
    return sorted(PLACEHOLDER_RE.findall(text))


def is_allowed_identical(key: str, value: str) -> bool:
    if key in ALLOW_IDENTICAL_KEYS:
        return True
    if value in ALLOW_IDENTICAL_VALUES:
        return True
    # Short brand-only / product fragments that include allowlisted tokens.
    if any(token == value or value.startswith(token) for token in ALLOW_IDENTICAL_VALUES):
        if len(value) <= 40:
            return True
    return False


def load_locale(code: str) -> dict[str, str]:
    path = LOCALES_DIR / f"{code}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return flatten(data)


def main() -> int:
    en = load_locale("en")
    errors: list[str] = []
    warnings: list[str] = []

    print(f"en keys: {len(en)}")

    for lang in LANGS:
        loc = load_locale(lang)
        missing = sorted(set(en) - set(loc))
        extra = sorted(set(loc) - set(en))
        if missing:
            errors.append(f"{lang}: missing {len(missing)} keys (e.g. {missing[:5]})")
        if extra:
            errors.append(f"{lang}: extra {len(extra)} keys (e.g. {extra[:5]})")

        placeholder_mismatches = []
        leftovers = []
        for key, en_val in en.items():
            if key not in loc:
                continue
            loc_val = loc[key]
            if placeholders(en_val) != placeholders(loc_val):
                placeholder_mismatches.append(key)
            if loc_val == en_val and not is_allowed_identical(key, en_val):
                leftovers.append(key)

        if placeholder_mismatches:
            errors.append(
                f"{lang}: placeholder mismatch on {len(placeholder_mismatches)} keys "
                f"(e.g. {placeholder_mismatches[:5]})"
            )
        if leftovers:
            # Hard fail: leftover English means the locale is incomplete.
            errors.append(
                f"{lang}: {len(leftovers)} strings still identical to English "
                f"(e.g. {leftovers[:8]})"
            )

        print(
            f"{lang}: keys={len(loc)} missing={len(missing)} extra={len(extra)} "
            f"leftover_en={len(leftovers)} placeholder_issues={len(placeholder_mismatches)}"
        )

    if warnings:
        for w in warnings:
            print(f"WARN: {w}", file=sys.stderr)

    if errors:
        print("\ni18n check FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        print(
            "\nAdd/update keys in ALL of: en, nl, fr, es, de, it. "
            "See .cursor/rules/i18n-all-languages.mdc",
            file=sys.stderr,
        )
        return 1

    print("\ni18n check OK — all locales complete.")

    # Keep gustra.net/localization table in sync with locale files.
    gen = ROOT / "scripts" / "generate-localization-site.py"
    if gen.is_file():
        import subprocess

        result = subprocess.run(
            [sys.executable, "-u", str(gen)],
            cwd=ROOT,
            check=False,
        )
        if result.returncode != 0:
            print("WARN: localization site regenerate failed", file=sys.stderr)
            return 1
        print("localization/index.html regenerated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
