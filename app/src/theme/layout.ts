import { spacing } from './spacing';

export const layout = {
  breakpoints: {
    veryCompact: 420,
    compact: 768,
    wide: 1024,
    large: 1280,
  },
  maxWidth: {
    admin: 1320,
    kiosk: 1360,
    form: 760,
    reading: 640,
  },
  paddingX: {
    veryCompact: spacing.md,
    compact: spacing.scale[5],
    wide: spacing.lg,
    large: spacing.xl,
  },
  paddingY: {
    screen: spacing.lg,
    section: spacing.lg,
    contentBottom: spacing.xxl,
  },
  gap: {
    inline: spacing.inline,
    row: spacing.row,
    card: spacing.md,
    section: spacing.section,
    hero: spacing.hero,
  },
  touchTarget: {
    minimum: 44,
    comfortable: 52,
    large: 60,
  },
  cardHeights: {
    metric: 148,
    hero: 220,
  },
} as const;
