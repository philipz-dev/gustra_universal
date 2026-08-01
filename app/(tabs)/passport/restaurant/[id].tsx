/**
 * Restaurant visits overview, scoped under My Gustra so Back returns to the
 * passport (Top-3 restaurant → My Gustra), not the Reviews feed. The shared
 * screen detects this stack via `usePathname()` and links review taps to the
 * passport review detail.
 */
export { default } from '../../(main)/restaurant/[id]';
