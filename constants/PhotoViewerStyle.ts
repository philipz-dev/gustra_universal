import { GustraColors } from '@/constants/Colors';

/**
 * Immersive lightbox tokens (Swift `PhotoViewerCinematicStyle`).
 * Master switch `isEnabled` restores cream house chrome when false.
 */
export const PhotoViewerStyle = {
  isEnabled: true,

  /** Deep forest near `#0C1B13`. */
  backdropEnabled: '#0C1B13',
  backdropDisabled: GustraColors.cream,

  chromeForeground: '#FFFFFF',
  pillBackgroundEnabled: 'rgba(255, 255, 255, 0.14)',
  pillForegroundEnabled: 'rgba(255, 255, 255, 0.92)',
  pillBackgroundDisabled: GustraColors.bubble,
  pillForegroundDisabled: 'rgba(35, 32, 26, 0.55)',
  chromeButtonFill: 'rgba(255, 255, 255, 0.12)',

  dismissThreshold: 140,
  dismissVelocityThreshold: 900,

  get backdrop() {
    return this.isEnabled ? this.backdropEnabled : this.backdropDisabled;
  },
  get pillBackground() {
    return this.isEnabled
      ? this.pillBackgroundEnabled
      : this.pillBackgroundDisabled;
  },
  get pillForeground() {
    return this.isEnabled
      ? this.pillForegroundEnabled
      : this.pillForegroundDisabled;
  },
} as const;
