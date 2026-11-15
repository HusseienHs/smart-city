/**
 * Motion: short and subtle. Everything here is skipped when the system "Reduce Motion" setting
 * is on (see `useMotion` in ./index).
 */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  /** Scale of pressed cards and buttons. */
  pressScale: 0.97,
  /** Distance a section rises while fading in on first load. */
  enterOffset: 10,
} as const;
