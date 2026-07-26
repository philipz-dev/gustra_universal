---
name: debug-hermes-crash
description: >-
  Triages iOS/TestFlight Hermes and Reanimated crash logs for Gustra (Expo).
  Classifies Worklets/DisplayLink/runOnJS stacks, checks known gesture/crop
  hotspots, and proposes a minimal fix. Use when the user pastes an .ips crash
  report, SIGABRT/Hermes/RNWorklets stack, or asks to debug a TestFlight crash.
---

# Debug Hermes / Reanimated crash (Gustra)

## Goal

Turn a crash log into a **likely cause + minimal code fix** (or clear ask for more info). Do not ship broad refactors.

## Procedure

1. **Classify the stack**
   - `hermesvm` + `throwPendingError` / `checkStatus` → uncaught **JS** exception.
   - `RNWorklets` + `AnimationFrameBatchinator` / `DisplayLink` / `runSync` → failure inside a **Reanimated/worklet frame** (often gesture `runOnJS`).
   - Pure UIKit/native frames without Hermes/Worklets → not this skill’s primary path; say so and stop guessing Reanimated.

2. **Scan Gustra hotspots** (read before editing)

   | Area | Path |
   |------|------|
   | Wine label crop | `components/wine/LabelCropCanvas.tsx` |
   | Star scrub | `components/review/InteractiveStarRating.tsx` |
   | Hero tap | `components/detail/HeroPhotoPager.tsx` |
   | Zoom / viewers | `components/detail/photoViewer/ZoomablePhoto.tsx`, `ReviewPhotoViewer.tsx`, `ProfilePhotoViewer.tsx` |
   | Profile crop | `components/settings/CircularCropCanvas.tsx` |
   | Filter sheet | `components/feed/FilterOptionsModal.tsx` |
   | Feed swipe | `components/feed/FeedSwipeDelete.tsx` |
   | Tab bar / heart | `components/ui/GustraTabBar.tsx`, `FavoriteHeartButton.tsx` |

   Also search the diff / recent changes for `runOnJS`, `Gesture.`, `useAnimatedStyle`, `'worklet'`.

3. **Enforce bridging rules** (see `.cursor/rules/reanimated-gestures.mdc`)
   - Stable `runOnJS` targets (`useCallback` + refs for latest parent callbacks).
   - `Gesture.*` trees in `useMemo` (no recreate every render).
   - No fresh function literals into worklets / `runOnJS`.
   - Unmount guard before `setState` / parent callbacks from `runOnJS`.

4. **If the log lacks a JS exception message**
   - State that the `.ips` alone often only proves Worklets/DisplayLink.
   - Ask for Hermes console line / reproduce steps (e.g. Drinks → Scan → pinch/pan).
   - Still propose the most likely hotspot from timeline + hotspots above.

5. **Fix style**
   - Minimal patch matching `InteractiveStarRating` / fixed `LabelCropCanvas`.
   - After app code changes: `python3 scripts/dump-full-config.py`; plan sync per repo rules if the fix is a shipped change.
   - Do not commit unless asked.

## Output format

- **Verdict:** JS/worklet vs other  
- **Suspect file(s):** path + why  
- **Fix:** what changed (or proposed)  
- **Reproduce:** short steps  
- **Missing info:** only if blocked  

## Examples

- User pastes TestFlight `.ips` with `RNWorklets` + `AnimationFrameBatchinator` → check `LabelCropCanvas` / other gesture screens → stabilize gestures.  
- User says “app aborted while scrubbing stars” → start at `InteractiveStarRating.tsx`.
