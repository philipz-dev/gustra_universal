#!/usr/bin/env python3
"""Build https://gustra.net/github/ from GitHub + plan changelog."""
from __future__ import annotations

import html
import json
import re
import subprocess
from datetime import datetime, timezone
from ftplib import FTP, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "roadmap" / "github"
OUT_HTML = OUT_DIR / "index.html"
PLAN_HTML = ROOT / "roadmap" / "plan" / "index.html"
CREDS = Path.home() / "Desktop" / "credentials.txt"
HOST = "da039.site.eu"
USER = "ysnl39dbaf"
REMOTE_DIR = "domains/gustra.net/public_html/github"
REPO = "philipz-dev/gustra_universal"
GH_REPO_URL = f"https://github.com/{REPO}"

SKIP_SUBJECT = re.compile(
    r"^(bump\s+(ios|android)|checkpoint\s+before|"
    r"merge\s+(branch|pull\s+request)|wip\b)",
    re.I,
)
COAUTHOR = re.compile(r"^Co-authored-by:.*$", re.I | re.M)
SKIP_FILES = {
    "GUSTRA_UNIVERSAL_FULL.txt",
    "package-lock.json",
}
TASK_RE = re.compile(
    r'\{\s*id:\s*"(?P<id>chg-[^"]+)"\s*,\s*title:\s*"(?P<title>(?:\\.|[^"\\])*)"'
    r'(?:[^}]*?badge:\s*"(?P<badge>[^"]*)")?'
    r'(?:[^}]*?date:\s*"(?P<date>[^"]*)")?',
    re.S,
)
GROUP_RE = re.compile(
    r'id:\s*"(new-\d{4}-\d{2}-\d{2})"\s*,\s*title:\s*"([^"]+)"\s*,\s*tasks:\s*\[(.*?)\]\s*,?\s*\}',
    re.S,
)


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


def gh_json(path: str) -> object:
    raw = subprocess.check_output(["gh", "api", path], text=True, cwd=ROOT)
    return json.loads(raw)


def fetch_repo() -> dict:
    data = gh_json(f"repos/{REPO}")
    return data if isinstance(data, dict) else {}


def fetch_releases() -> list[dict]:
    data = gh_json(f"repos/{REPO}/releases?per_page=50")
    return data if isinstance(data, list) else []


def fetch_commits(limit: int = 100) -> list[dict]:
    data = gh_json(f"repos/{REPO}/commits?per_page={limit}")
    return data if isinstance(data, list) else []


def fetch_commit_detail(sha: str) -> dict:
    data = gh_json(f"repos/{REPO}/commits/{sha}")
    return data if isinstance(data, dict) else {}


def split_message(message: str) -> tuple[str, str]:
    parts = message.strip().split("\n", 1)
    subject = parts[0].strip()
    body = parts[1].strip() if len(parts) > 1 else ""
    body = COAUTHOR.sub("", body).strip()
    return subject, body


def is_useful_commit(subject: str) -> bool:
    return bool(subject) and not SKIP_SUBJECT.search(subject)


def fmt_date(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y")
    except ValueError:
        return iso[:10]


def unescape_js_string(s: str) -> str:
    return (
        s.replace("\\n", "\n")
        .replace('\\"', '"')
        .replace("\\'", "'")
        .replace("\\\\", "\\")
    )


def parse_plan_changelog() -> list[dict]:
    """Extract New-tab day groups from plan DEFAULT_SECTIONS."""
    if not PLAN_HTML.exists():
        return []
    text = PLAN_HTML.read_text(encoding="utf-8")
    # Slice to the `new` section only.
    m = re.search(
        r'id:\s*"new"\s*,\s*title:\s*"New"\s*,\s*groups:\s*\[(.*?)\n\s*\]\s*,\s*\n\s*\{',
        text,
        re.S,
    )
    if not m:
        # Fallback: from id:"new" until id:"parity"
        m2 = re.search(r'id:\s*"new".*?id:\s*"parity"', text, re.S)
        chunk = m2.group(0) if m2 else text
    else:
        chunk = m.group(1)

    groups: list[dict] = []
    for gm in GROUP_RE.finditer(chunk):
        day_id, day_title, tasks_blob = gm.group(1), gm.group(2), gm.group(3)
        tasks = []
        for tm in TASK_RE.finditer(tasks_blob):
            tasks.append(
                {
                    "id": tm.group("id"),
                    "title": unescape_js_string(tm.group("title")),
                    "badge": tm.group("badge") or "Added/fixed",
                    "date": tm.group("date") or "",
                }
            )
        if tasks:
            groups.append({"id": day_id, "title": day_title, "tasks": tasks})
    return groups


def mdish_to_html(text: str) -> str:
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return ""
    blocks: list[str] = []
    for para in re.split(r"\n\s*\n", text):
        lines = [ln.rstrip() for ln in para.split("\n") if ln.strip()]
        if not lines:
            continue
        if all(re.match(r"^[-*•]\s+", ln) for ln in lines):
            items = []
            for ln in lines:
                item = re.sub(r"^[-*•]\s+", "", ln)
                items.append(f"<li>{inline_fmt(item)}</li>")
            blocks.append("<ul>" + "".join(items) + "</ul>")
        else:
            blocks.append("<p>" + "<br />".join(inline_fmt(ln) for ln in lines) + "</p>")
    return "\n".join(blocks)


def inline_fmt(text: str) -> str:
    esc = html.escape(text)
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc)


def files_html(detail: dict) -> str:
    stats = detail.get("stats") or {}
    files = detail.get("files") or []
    shown = [
        f
        for f in files
        if Path(f.get("filename") or "").name not in SKIP_FILES
        and not str(f.get("filename") or "").endswith("package-lock.json")
    ][:8]
    bits = []
    add = stats.get("additions")
    dele = stats.get("deletions")
    if add is not None and dele is not None:
        bits.append(
            f'<span class="diff"><span class="add">+{add}</span> '
            f'<span class="del">−{dele}</span></span>'
        )
    if shown:
        lis = "".join(
            f'<li><code>{html.escape(f.get("filename") or "")}</code> '
            f'<span class="muted">({html.escape(f.get("status") or "modified")})</span></li>'
            for f in shown
        )
        more = len(files) - len(shown)
        if more > 0:
            lis += f'<li class="muted">+{more} more files</li>'
        bits.append(f'<ul class="files">{lis}</ul>')
    if not bits:
        return ""
    return '<div class="files-block">' + "".join(bits) + "</div>"


def render_page(
    repo: dict,
    releases: list[dict],
    commits: list[dict],
    commit_details: dict[str, dict],
    plan_groups: list[dict],
) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    desc = html.escape(repo.get("description") or "Gustra universal app")
    created = fmt_date(repo.get("created_at"))
    pushed = fmt_date(repo.get("pushed_at"))

    # --- Plan changelog (richest human notes) ---
    plan_html: list[str] = []
    if plan_groups:
        for g in plan_groups:
            items = []
            for t in g["tasks"]:
                badge = html.escape(t["badge"])
                items.append(
                    f'<li><span class="badge ok">{badge}</span> '
                    f'{html.escape(t["title"])}</li>'
                )
            plan_html.append(
                f"""
        <div class="day">
          <h3 class="day-title">{html.escape(g["title"])}</h3>
          <ul class="changelog">{"".join(items)}</ul>
        </div>"""
            )
    else:
        plan_html.append('<div class="empty"><p>No plan changelog found.</p></div>')

    # --- Releases ---
    release_html: list[str] = []
    if releases:
        for rel in releases:
            tag = html.escape(rel.get("tag_name") or "")
            name = html.escape(rel.get("name") or tag or "Release")
            when = fmt_date(rel.get("published_at") or rel.get("created_at"))
            url = html.escape(rel.get("html_url") or GH_REPO_URL)
            body = mdish_to_html(rel.get("body") or "") or (
                '<p class="muted">No release notes.</p>'
            )
            kind = (
                '<span class="badge warn">Pre-release</span>'
                if rel.get("prerelease")
                else '<span class="badge ok">Release</span>'
            )
            release_html.append(
                f"""
        <article class="card">
          <div class="card-head">
            <h3><a href="{url}" rel="noopener">{name}</a></h3>
            <div class="meta">{kind}<span>{html.escape(when)}</span><code>{tag}</code></div>
          </div>
          <div class="body">{body}</div>
        </article>"""
            )
    else:
        release_html.append(
            """
        <div class="empty">
          <p>No GitHub Releases yet (tags + release notes).</p>
          <p class="muted">Optional: <code>gh release create v1.0.0 --generate-notes</code> then <code>npm run deploy:github</code>.</p>
        </div>"""
        )

    # --- Commits ---
    commit_html: list[str] = []
    useful = 0
    for c in commits:
        msg = (c.get("commit") or {}).get("message") or ""
        subject, body = split_message(msg)
        if not is_useful_commit(subject):
            continue
        useful += 1
        if useful > 40:
            break
        sha_full = c.get("sha") or ""
        sha = sha_full[:7]
        url = html.escape(c.get("html_url") or f"{GH_REPO_URL}/commit/{sha_full}")
        when = fmt_date((c.get("commit") or {}).get("author", {}).get("date"))
        body_html = mdish_to_html(body) if body else ""
        detail = commit_details.get(sha_full) or {}
        commit_html.append(
            f"""
        <article class="card commit">
          <div class="card-head">
            <h3><a href="{url}" rel="noopener">{html.escape(subject)}</a></h3>
            <div class="meta"><span>{html.escape(when)}</span><code>{html.escape(sha)}</code></div>
          </div>
          {f'<div class="body">{body_html}</div>' if body_html else ''}
          {files_html(detail)}
        </article>"""
        )
    if not commit_html:
        commit_html.append('<div class="empty"><p>No useful commits found.</p></div>')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gustra — Versions &amp; changes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {{
      --forest: #244e39; --forest-deep: #1a3a2a; --cream: #f5eedd; --bubble: #ece3cf;
      --gold: #d9a227; --ink: #23201a; --ink-soft: rgba(35, 32, 26, 0.55);
      --ok: #388c56; --warn: #8a4b12; --danger: #c74742;
      --shadow: 0 18px 50px rgba(36, 78, 57, 0.12); --radius: 18px;
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      margin: 0; min-height: 100vh;
      font-family: "DM Sans", system-ui, sans-serif; color: var(--ink);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(217, 162, 39, 0.16), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(36, 78, 57, 0.14), transparent 50%),
        linear-gradient(180deg, #f8f3e7 0%, var(--cream) 45%, #efe6d2 100%);
    }}
    .wrap {{ width: min(920px, calc(100% - 2rem)); margin: 0 auto; padding: 2.25rem 0 4rem; }}
    header.hero {{
      background: linear-gradient(145deg, var(--forest) 0%, var(--forest-deep) 100%);
      color: #f7f1e4; border-radius: calc(var(--radius) + 6px);
      padding: 1.75rem 1.5rem 1.5rem; box-shadow: var(--shadow);
    }}
    .brand {{
      font-family: "Source Serif 4", Georgia, serif;
      font-size: clamp(2.2rem, 5vw, 3rem); font-weight: 700;
      letter-spacing: -0.03em; line-height: 0.95; margin: 0 0 0.45rem;
    }}
    .tagline {{ margin: 0; max-width: 38rem; color: rgba(247, 241, 228, 0.84); font-size: 1.02rem; line-height: 1.45; }}
    .stats {{
      display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 1.1rem;
    }}
    .stats span {{
      font-size: 0.82rem; font-weight: 600;
      padding: 0.35rem 0.7rem; border-radius: 999px;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.16);
    }}
    .hero-links {{ display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1.1rem; }}
    .hero-links a {{
      color: #f7f1e4; text-decoration: none; font-size: 0.92rem; font-weight: 600;
      padding: 0.45rem 0.8rem; border-radius: 999px;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
    }}
    .hero-links a:hover {{ background: rgba(217, 162, 39, 0.28); }}
    nav.toc {{ display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 1.25rem 0 1.5rem; }}
    nav.toc a {{
      color: var(--forest); text-decoration: none; font-weight: 600; font-size: 0.92rem;
      padding: 0.4rem 0.75rem; border-radius: 999px; background: rgba(36, 78, 57, 0.1);
    }}
    section.panel {{
      background: rgba(255,255,255,0.45); border: 1px solid rgba(35, 32, 26, 0.08);
      border-radius: var(--radius); padding: 1.25rem 1.15rem 1.4rem;
      margin-bottom: 1.25rem; box-shadow: 0 8px 24px rgba(36, 78, 57, 0.06);
    }}
    section.panel h2 {{
      font-family: "Source Serif 4", Georgia, serif; font-size: 1.55rem;
      margin: 0 0 0.35rem; color: var(--forest-deep);
    }}
    .section-meta {{ margin: 0 0 1rem; color: var(--ink-soft); font-size: 0.95rem; line-height: 1.4; }}
    .day {{ margin-bottom: 1.15rem; }}
    .day-title {{
      font-family: "Source Serif 4", Georgia, serif; font-size: 1.2rem;
      margin: 0 0 0.55rem; color: var(--forest);
    }}
    ul.changelog {{ list-style: none; padding: 0; margin: 0; }}
    ul.changelog li {{
      background: rgba(236, 227, 207, 0.55); border-radius: 12px;
      padding: 0.7rem 0.85rem; margin-bottom: 0.45rem;
      font-size: 0.95rem; line-height: 1.4;
      display: flex; gap: 0.55rem; align-items: flex-start;
    }}
    .card {{
      background: rgba(236, 227, 207, 0.55); border-radius: 14px;
      padding: 1rem 1rem 0.85rem; margin-bottom: 0.75rem;
    }}
    .card-head h3 {{ margin: 0 0 0.35rem; font-size: 1.08rem; font-weight: 600; line-height: 1.35; }}
    .card-head h3 a {{ color: var(--ink); text-decoration: none; }}
    .card-head h3 a:hover {{ color: var(--forest); }}
    .meta {{
      display: flex; flex-wrap: wrap; gap: 0.45rem 0.7rem; align-items: center;
      font-size: 0.82rem; color: var(--ink-soft);
    }}
    .meta code, .files code {{
      font-size: 0.78rem; background: rgba(35, 32, 26, 0.08);
      padding: 0.12rem 0.4rem; border-radius: 6px;
    }}
    .badge {{
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.03em;
      text-transform: uppercase; padding: 0.18rem 0.45rem; border-radius: 6px;
      flex: 0 0 auto; margin-top: 0.15rem;
    }}
    .badge.ok {{ color: #1a3a2a; background: rgba(56, 140, 86, 0.18); }}
    .badge.warn {{ color: var(--warn); background: rgba(217, 162, 39, 0.22); }}
    .body {{ margin-top: 0.65rem; font-size: 0.95rem; line-height: 1.45; color: rgba(35, 32, 26, 0.82); }}
    .body p {{ margin: 0 0 0.55rem; }}
    .body ul {{ margin: 0 0 0.55rem; padding-left: 1.2rem; }}
    .files-block {{ margin-top: 0.65rem; }}
    .diff {{ font-weight: 700; font-variant-numeric: tabular-nums; font-size: 0.86rem; }}
    .diff .add {{ color: var(--ok); margin-right: 0.45rem; }}
    .diff .del {{ color: var(--danger); }}
    ul.files {{ margin: 0.4rem 0 0; padding-left: 1.1rem; font-size: 0.86rem; }}
    ul.files li {{ margin: 0.15rem 0; }}
    .muted {{ color: var(--ink-soft); }}
    .empty {{ padding: 0.75rem 0.25rem; color: var(--ink-soft); }}
    footer {{ margin-top: 1.5rem; font-size: 0.85rem; color: var(--ink-soft); text-align: center; }}
    footer a {{ color: var(--forest); }}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1 class="brand">Gustra</h1>
      <p class="tagline">{desc}. What’s new from the plan changelog, GitHub Releases, and useful commits.</p>
      <div class="stats">
        <span>Created {html.escape(created)}</span>
        <span>Last push {html.escape(pushed)}</span>
        <span>{len(commits)} commits on main</span>
        <span>{sum(len(g['tasks']) for g in plan_groups)} plan notes</span>
      </div>
      <div class="hero-links">
        <a href="{GH_REPO_URL}" rel="noopener">GitHub repo</a>
        <a href="{GH_REPO_URL}/releases" rel="noopener">Releases</a>
        <a href="https://gustra.net/plan/">Plan</a>
        <a href="https://gustra.net/webversion/">Web app</a>
      </div>
    </header>

    <nav class="toc">
      <a href="#changelog">What’s new</a>
      <a href="#releases">Releases</a>
      <a href="#commits">Commits</a>
    </nav>

    <section class="panel" id="changelog">
      <h2>What’s new (from plan)</h2>
      <p class="section-meta">Human-readable shipping notes — the richest log while GitHub Releases are empty. Synced from <a href="https://gustra.net/plan/">gustra.net/plan</a>.</p>
      {"".join(plan_html)}
    </section>

    <section class="panel" id="releases">
      <h2>GitHub Releases</h2>
      <p class="section-meta">Tagged versions with release notes (when you create them on GitHub).</p>
      {"".join(release_html)}
    </section>

    <section class="panel" id="commits">
      <h2>Useful commits</h2>
      <p class="section-meta">Commit message + changed files (+/−). Skips buildNumber bumps and checkpoints.</p>
      {"".join(commit_html)}
    </section>

    <footer>
      Generated {html.escape(now)} · <a href="{GH_REPO_URL}">{html.escape(REPO)}</a> · <code>npm run deploy:github</code>
    </footer>
  </div>
</body>
</html>
"""


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


def upload() -> None:
    pw = password()
    print(f"Connecting to {HOST} as {USER} …")
    with FTP(HOST, timeout=30) as ftp:
        ftp.login(USER, pw)
        ftp.set_pasv(True)
        ensure_cwd(ftp, REMOTE_DIR)
        print("cwd →", ftp.pwd())
        with OUT_HTML.open("rb") as fh:
            ftp.storbinary("STOR index.html", fh)
        print(f"uploaded index.html ({OUT_HTML.stat().st_size} bytes)")
    print("OK — https://gustra.net/github/")


def main() -> None:
    print(f"Fetching GitHub + plan changelog for {REPO} …")
    repo = fetch_repo()
    releases = fetch_releases()
    commits = fetch_commits(100)
    plan_groups = parse_plan_changelog()
    print(f"  releases: {len(releases)}")
    print(f"  commits: {len(commits)}")
    print(f"  plan day groups: {len(plan_groups)} ({sum(len(g['tasks']) for g in plan_groups)} notes)")

    details: dict[str, dict] = {}
    useful_shas: list[str] = []
    for c in commits:
        subject, _ = split_message((c.get("commit") or {}).get("message") or "")
        if is_useful_commit(subject):
            useful_shas.append(c.get("sha") or "")
        if len(useful_shas) >= 25:
            break
    for sha in useful_shas:
        if not sha:
            continue
        print(f"  detail {sha[:7]} …")
        details[sha] = fetch_commit_detail(sha)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    page = render_page(repo, releases, commits, details, plan_groups)
    OUT_HTML.write_text(page, encoding="utf-8")
    print(f"Wrote {OUT_HTML} ({OUT_HTML.stat().st_size} bytes)")
    upload()


if __name__ == "__main__":
    main()
