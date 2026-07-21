/**
 * Gustra house colors (aligned with iOS Theme.swift).
 * App UI is light/cream-first; dark tokens are kept for system fallbacks.
 */
const forestGreen = '#244E39';
const cream = '#F5EEDD';
const bubble = '#ECE3CF';
const gold = '#D9A227';
const ink = '#23201A';

export const GustraColors = {
  forestGreen,
  cream,
  bubble,
  gold,
  ink,
  ratingExcellent: '#388C57',
  ratingNeutral: '#DB852E',
  ratingAvoid: '#C74742',
} as const;

export default {
  light: {
    text: ink,
    background: cream,
    tint: forestGreen,
    tabIconDefault: 'rgba(35, 32, 26, 0.45)',
    tabIconSelected: forestGreen,
    card: bubble,
    border: 'rgba(35, 32, 26, 0.08)',
  },
  dark: {
    text: cream,
    background: ink,
    tint: gold,
    tabIconDefault: 'rgba(245, 238, 221, 0.45)',
    tabIconSelected: gold,
    card: '#2C2822',
    border: 'rgba(245, 238, 221, 0.12)',
  },
};
