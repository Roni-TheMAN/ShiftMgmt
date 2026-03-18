import { colors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';

export const componentTokens = {
  button: {
    radius: radius.button,
    heights: {
      sm: 40,
      md: 54,
      lg: 60,
    },
    paddingX: {
      sm: spacing.md,
      md: spacing.lg,
      lg: spacing.xl,
    },
    variants: {
      primary: {
        backgroundColor: colors.accents.bronze,
        borderColor: colors.accents.bronze,
        pressedBackgroundColor: colors.accents.bronzePressed,
        textColor: colors.text.inverse,
        shadow: shadows.raised,
      },
      secondary: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.borders.default,
        pressedBackgroundColor: colors.backgrounds.secondary,
        textColor: colors.text.primary,
        shadow: shadows.none,
      },
      tonalBronze: {
        backgroundColor: colors.tints.bronze,
        borderColor: 'transparent',
        pressedBackgroundColor: '#ECD9BC',
        textColor: colors.accents.bronze,
        shadow: shadows.none,
      },
      success: {
        backgroundColor: colors.accents.olive,
        borderColor: colors.accents.olive,
        pressedBackgroundColor: colors.accents.olivePressed,
        textColor: colors.text.inverse,
        shadow: shadows.raised,
      },
      tonalTerracotta: {
        backgroundColor: colors.tints.terracotta,
        borderColor: 'transparent',
        pressedBackgroundColor: '#E6C9BD',
        textColor: colors.accents.terracotta,
        shadow: shadows.none,
      },
      danger: {
        backgroundColor: colors.tints.danger,
        borderColor: 'transparent',
        pressedBackgroundColor: '#EFD1D1',
        textColor: colors.states.danger,
        shadow: shadows.none,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        pressedBackgroundColor: colors.tints.bronze,
        textColor: colors.text.secondary,
        shadow: shadows.none,
      },
    },
  },
  card: {
    radius: radius.card,
    heroRadius: radius.heroCard,
    borderWidth: 1,
    padding: {
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
    },
    variants: {
      default: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.borders.default,
        shadow: shadows.card,
      },
      secondary: {
        backgroundColor: colors.backgrounds.secondary,
        borderColor: colors.borders.subtle,
        shadow: shadows.none,
      },
      hero: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.borders.subtle,
        shadow: shadows.raised,
      },
      warning: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.accents.terracotta,
        shadow: shadows.card,
      },
      danger: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.states.danger,
        shadow: shadows.card,
      },
      row: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.borders.subtle,
        shadow: shadows.none,
      },
    },
  },
  chip: {
    radius: radius.chip,
    minHeight: {
      sm: 26,
      md: 30,
    },
    paddingX: {
      sm: spacing.xs,
      md: spacing.sm,
    },
    variants: {
      neutral: {
        backgroundColor: colors.backgrounds.secondary,
        borderColor: colors.borders.subtle,
        textColor: colors.text.secondary,
      },
      bronze: {
        backgroundColor: colors.tints.bronze,
        borderColor: 'transparent',
        textColor: colors.accents.bronze,
      },
      terracotta: {
        backgroundColor: colors.tints.terracotta,
        borderColor: 'transparent',
        textColor: colors.accents.terracotta,
      },
      olive: {
        backgroundColor: colors.tints.olive,
        borderColor: 'transparent',
        textColor: colors.accents.olive,
      },
      danger: {
        backgroundColor: colors.tints.danger,
        borderColor: 'transparent',
        textColor: colors.states.danger,
      },
    },
  },
  input: {
    radius: radius.input,
    minHeight: 54,
    minHeightMultiline: 112,
    paddingX: spacing.md,
    paddingY: spacing.sm,
    gap: {
      labelToDescription: spacing.xxs,
      fieldToMessage: spacing.xs,
    },
    messageMinHeight: 18,
    variants: {
      default: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.borders.default,
        textColor: colors.text.primary,
        placeholderColor: colors.text.muted,
        labelColor: colors.text.primary,
        descriptionColor: colors.text.secondary,
      },
      readonly: {
        backgroundColor: colors.backgrounds.secondary,
        borderColor: colors.borders.subtle,
        textColor: colors.text.secondary,
        placeholderColor: colors.text.muted,
        labelColor: colors.text.primary,
        descriptionColor: colors.text.secondary,
      },
      danger: {
        backgroundColor: colors.backgrounds.card,
        borderColor: colors.states.danger,
        textColor: colors.text.primary,
        placeholderColor: colors.text.muted,
        labelColor: colors.states.danger,
        descriptionColor: colors.states.danger,
      },
    },
    disabled: {
      backgroundColor: colors.backgrounds.secondary,
      borderColor: colors.borders.subtle,
      textColor: colors.text.muted,
      labelColor: colors.text.secondary,
      descriptionColor: colors.text.muted,
      placeholderColor: colors.text.muted,
    },
    focusRing: {
      borderColor: colors.borders.focus,
      shadow: shadows.focusRing,
    },
  },
  formSection: {
    contentGap: spacing.md,
    headerGap: spacing.xs,
    footerGap: spacing.md,
  },
} as const;
