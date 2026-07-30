#!/usr/bin/env python3
"""Generate https://gustra.net/localization/ from i18n/locales/*.json.

Run via: python3 scripts/generate-localization-site.py
Also invoked automatically after a successful `npm run i18n:check`.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = ROOT / "i18n" / "locales"
OUT_DIR = ROOT / "localization"
OUT_FILE = OUT_DIR / "index.html"

# Display order: English first, then other app locales.
LANGS = (
    ("en", "English"),
    ("nl", "Nederlands"),
    ("fr", "Français"),
    ("es", "Español"),
    ("de", "Deutsch"),
    ("it", "Italiano"),
)


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


def load_locale(code: str) -> dict[str, str]:
    path = LOCALES_DIR / f"{code}.json"
    return flatten(json.loads(path.read_text(encoding="utf-8")))


def build_rows(locales: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    en = locales["en"]
    keys = sorted(en.keys())
    rows: list[dict[str, str]] = []
    for key in keys:
        row = {"key": key}
        for code, _ in LANGS:
            row[code] = locales.get(code, {}).get(key, "")
        rows.append(row)
    return rows


def render_html(rows: list[dict[str, str]], generated_at: str) -> str:
    ths = ['<th scope="col" class="col-key">Key</th>']
    for code, label in LANGS:
        ths.append(f'<th scope="col" data-lang="{html.escape(code)}">{html.escape(label)}</th>')

    body_rows: list[str] = []
    for row in rows:
        cells = [
            f'<td class="col-key"><code>{html.escape(row["key"])}</code></td>',
        ]
        for code, _ in LANGS:
            cells.append(
                f'<td data-lang="{html.escape(code)}">{html.escape(row[code])}</td>'
            )
        search_blob = " ".join(
            [row["key"]] + [row[code] for code, _ in LANGS]
        ).lower()
        body_rows.append(
            f'<tr data-search="{html.escape(search_blob, quote=True)}">'
            + "".join(cells)
            + "</tr>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gustra — Localization</title>
  <meta name="description" content="Gustra UI strings: English and all app locales (nl, fr, es, de, it)." />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {{
      --forest: #244e39;
      --forest-deep: #1a3a2a;
      --cream: #f5eedd;
      --bubble: #ece3cf;
      --gold: #d9a227;
      --ink: #23201a;
      --ink-soft: rgba(35, 32, 26, 0.55);
      --line: rgba(35, 32, 26, 0.1);
      --shadow: 0 18px 50px rgba(36, 78, 57, 0.12);
      --radius: 18px;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "DM Sans", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(217, 162, 39, 0.16), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(36, 78, 57, 0.14), transparent 50%),
        linear-gradient(180deg, #f8f3e7 0%, var(--cream) 45%, #efe6d2 100%);
      line-height: 1.45;
    }}
    .wrap {{
      width: min(1280px, calc(100% - 1.5rem));
      margin: 0 auto;
      padding: 1.75rem 0 3.5rem;
    }}
    header.hero {{
      background: linear-gradient(145deg, var(--forest) 0%, var(--forest-deep) 100%);
      color: #f7f1e4;
      border-radius: calc(var(--radius) + 6px);
      padding: 1.5rem 1.35rem 1.35rem;
      box-shadow: var(--shadow);
    }}
    .brand {{
      font-family: "Source Serif 4", Georgia, serif;
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      margin: 0 0 0.35rem;
      line-height: 0.95;
    }}
    .tagline {{
      margin: 0;
      max-width: 40rem;
      color: rgba(247, 241, 228, 0.84);
      font-size: 1.02rem;
    }}
    .meta {{
      margin: 0.9rem 0 0;
      font-size: 0.88rem;
      color: rgba(247, 241, 228, 0.68);
    }}
    .meta a {{ color: var(--gold); font-weight: 600; }}
    .toolbar {{
      margin-top: 1.15rem;
      display: grid;
      gap: 0.75rem;
      grid-template-columns: 1fr auto;
      align-items: center;
    }}
    @media (max-width: 720px) {{
      .toolbar {{ grid-template-columns: 1fr; }}
    }}
    #q {{
      width: 100%;
      border: 1px solid rgba(35, 32, 26, 0.14);
      border-radius: 999px;
      padding: 0.7rem 1.05rem;
      font: inherit;
      font-size: 0.98rem;
      background: rgba(255, 255, 255, 0.72);
      color: var(--ink);
      outline: none;
    }}
    #q:focus {{
      border-color: rgba(36, 78, 57, 0.45);
      box-shadow: 0 0 0 3px rgba(36, 78, 57, 0.12);
    }}
    .count {{
      font-size: 0.9rem;
      color: var(--ink-soft);
      white-space: nowrap;
      padding-inline: 0.25rem;
    }}
    .panel {{
      margin-top: 1.1rem;
      background: rgba(255, 255, 255, 0.48);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 8px 24px rgba(36, 78, 57, 0.06);
      overflow: hidden;
    }}
    .scroll {{
      overflow: auto;
      max-height: min(78vh, 920px);
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      min-width: 980px;
    }}
    thead th {{
      position: sticky;
      top: 0;
      z-index: 2;
      background: #e8dfc8;
      color: var(--forest-deep);
      text-align: left;
      font-weight: 600;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid rgba(36, 78, 57, 0.18);
    }}
    tbody td {{
      padding: 0.55rem 0.85rem;
      vertical-align: top;
      border-bottom: 1px solid var(--line);
      max-width: 16rem;
      word-break: break-word;
    }}
    tbody tr:nth-child(even) td {{ background: rgba(236, 227, 207, 0.35); }}
    tbody tr:hover td {{ background: rgba(36, 78, 57, 0.07); }}
    tbody tr.is-hidden {{ display: none; }}
    .col-key {{
      position: sticky;
      left: 0;
      z-index: 1;
      background: #f3ecdc;
      min-width: 12rem;
      max-width: 18rem;
    }}
    thead .col-key {{ z-index: 3; background: #e0d5b8; }}
    tbody tr:nth-child(even) .col-key {{ background: #ebe2cd; }}
    tbody tr:hover .col-key {{ background: #dde8e0; }}
    code {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--forest-deep);
    }}
    footer {{
      margin-top: 1.25rem;
      color: var(--ink-soft);
      font-size: 0.88rem;
    }}
    footer a {{ color: var(--forest); font-weight: 600; }}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="brand">Gustra</p>
      <p class="tagline">Localization table — every UI string in English and the five other app languages.</p>
      <p class="meta">{len(rows)} keys · generated {html.escape(generated_at)} · source <code>i18n/locales/*.json</code></p>
    </header>

    <div class="toolbar">
      <label class="visually-hidden" for="q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Filter</label>
      <input id="q" type="search" placeholder="Filter by key or any language…" autocomplete="off" spellcheck="false" />
      <p class="count"><span id="visible">{len(rows)}</span> / {len(rows)}</p>
    </div>

    <div class="panel">
      <div class="scroll">
        <table>
          <thead>
            <tr>{"".join(ths)}</tr>
          </thead>
          <tbody>
            {"".join(body_rows)}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Auto-updated when locales change (<code>npm run i18n:check</code> / <code>npm run localization:build</code>).
      Deploy: <code>npm run deploy:localization</code> →
      <a href="https://gustra.net/localization/">gustra.net/localization</a>
    </footer>
  </div>
  <script>
    (function () {{
      var input = document.getElementById("q");
      var visible = document.getElementById("visible");
      var rows = Array.prototype.slice.call(document.querySelectorAll("tbody tr"));
      function apply() {{
        var q = (input.value || "").trim().toLowerCase();
        var n = 0;
        for (var i = 0; i < rows.length; i++) {{
          var row = rows[i];
          var ok = !q || (row.getAttribute("data-search") || "").indexOf(q) !== -1;
          row.classList.toggle("is-hidden", !ok);
          if (ok) n++;
        }}
        visible.textContent = String(n);
      }}
      input.addEventListener("input", apply);
    }})();
  </script>
</body>
</html>
"""


def main() -> int:
    locales = {code: load_locale(code) for code, _ in LANGS}
    en_keys = set(locales["en"])
    for code, _ in LANGS:
        if code == "en":
            continue
        missing = en_keys - set(locales[code])
        if missing:
            print(
                f"WARN: {code} missing {len(missing)} keys — empty cells for those",
                flush=True,
            )
    rows = build_rows(locales)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(render_html(rows, generated_at), encoding="utf-8")
    print(f"Wrote {OUT_FILE} ({len(rows)} keys)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
