---
name: gustra-pr-checklist
description: >-
  Reviews a Gustra (Expo / React Native) PR or local diff for merge safety:
  backwards-compatible data, i18n, Reanimated gesture bridging, photo/feed
  consistency, and repo dump/plan obligations. Use when the user asks to review
  a PR, pre-merge checklist, “safe to merge”, or TestFlight-readiness of changes.
---

# Gustra PR checklist

## Goal

Produce a short **merge-ready review** of the current PR or uncommitted/branch diff. Fix only clear, in-scope issues if the user asked to fix; otherwise report findings.

## Gather

- `git status`, `git diff` (and `git diff main...HEAD` or the PR base when relevant)
- Touched paths under `context/`, `services/backup|share|migration/`, `components/`, `i18n/`, `app/`

## Checklist

### 1. Data compatibility (blocking)

- No breaking AsyncStorage / `.gustra` / `.gustrashare` / Swift store changes without dual-read migration.
- Prefer additive fields; never silent wipe of reviews/photos.
- See `.cursor/rules/backwards-compatible-data.mdc`.

### 2. Reanimated / gestures (blocking if touched)

If the diff includes `runOnJS`, `Gesture.`, worklets, or `react-native-reanimated`:

- Stable `runOnJS` (`useCallback` + refs)
- `Gesture.*` in `useMemo`
- No render-time function literals into worklets
- Unmount guards where `runOnJS` calls into React

Refs: `InteractiveStarRating.tsx`, `LabelCropCanvas.tsx`, `.cursor/rules/reanimated-gestures.mdc`.

### 3. UI / photos / native patterns

- Empty or failed photos use shared `PhotoPlaceholder` / fork.knife (not a blank green box).
- Feed thumb updates when cover changes or photos are deleted (`ReviewsStore` cover recompute; `RestaurantThumb` resets `failed` on URI change).
- Take/Import actions that are peers should share the same primary button style.
- New interactive UI prefers platform/Expo system patterns over custom cross-platform widgets (see `.cursor/rules/native-platform-ui.mdc`). Do not block the PR solely to rewrite existing House chrome (nav, stars, branded alerts) unless the diff already touches that control.

### 4. i18n

- New user-facing copy → keys in `i18n/locales/` (en + nl minimum; keep other locales in sync when the key set exists).
- No hardcoded UI strings in new screens when the feature is localized elsewhere.

### 5. Repo obligations (if recommending “shipped”)

- App code changes → `python3 scripts/dump-full-config.py`
- Finished user-facing work → plan entry + `python3 roadmap/deploy.py` per `.cursor/rules/plan-website.mdc`
- Do not commit or push unless the user asked.

### 6. Out of scope unless asked

- Unrelated refactors, dependency bumps, CI workflow weakenings, force-push.

## Output format

```markdown
## Verdict
Merge-ready | Needs fixes | Needs info

## Findings
- [blocking] …
- [nit] …

## Touched risk areas
Data / Reanimated / Photos / i18n / none

## Suggested test plan
- …
```

## Examples

- “Is this branch safe for TestFlight?” → run checklist on `main...HEAD`.  
- “Review my PR” → same, plus call out missing dump/plan if they claim the feature is done.
