import { Platform, type TextStyle } from 'react-native';

type TypographyStyle = Readonly<TextStyle>;

const fontFamilies = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }) as string,
} as const;

const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
} as const;

function createTextStyle({
  family = fontFamilies.sans,
  fontVariant,
  letterSpacing = 0,
  lineHeight,
  size,
  weight = fontWeights.regular,
}: {
  family?: string;
  fontVariant?: TextStyle['fontVariant'];
  letterSpacing?: number;
  lineHeight: number;
  size: number;
  weight?: TextStyle['fontWeight'];
}): TypographyStyle {
  return {
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
    letterSpacing,
    lineHeight,
    ...(fontVariant ? { fontVariant } : {}),
  };
}

export { fontFamilies, fontWeights };

export const typography = {
  timeHero: createTextStyle({
    family: fontFamilies.serif,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.2,
    lineHeight: 60,
    size: 56,
    weight: fontWeights.semibold,
  }),
  screenTitle: createTextStyle({
    letterSpacing: -0.4,
    lineHeight: 38,
    size: 32,
    weight: fontWeights.semibold,
  }),
  sectionTitle: createTextStyle({
    lineHeight: 30,
    size: 24,
    weight: fontWeights.semibold,
  }),
  cardTitle: createTextStyle({
    lineHeight: 26,
    size: 20,
    weight: fontWeights.semibold,
  }),
  bodyLg: createTextStyle({
    lineHeight: 25,
    size: 17,
  }),
  body: createTextStyle({
    lineHeight: 24,
    size: 16,
  }),
  bodySm: createTextStyle({
    lineHeight: 20,
    size: 14,
  }),
  label: createTextStyle({
    lineHeight: 20,
    size: 15,
    weight: fontWeights.semibold,
  }),
  chip: createTextStyle({
    lineHeight: 16,
    size: 12,
    weight: fontWeights.semibold,
  }),
  micro: createTextStyle({
    letterSpacing: 0.6,
    lineHeight: 14,
    size: 11,
    weight: fontWeights.semibold,
  }),
  numeric: createTextStyle({
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
    size: 16,
    weight: fontWeights.medium,
  }),

  // Backward-compatible aliases for the current app UI.
  display: createTextStyle({
    family: fontFamilies.serif,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.1,
    lineHeight: 68,
    size: 60,
    weight: fontWeights.semibold,
  }),
  title: createTextStyle({
    letterSpacing: -0.5,
    lineHeight: 42,
    size: 36,
    weight: fontWeights.semibold,
  }),
  h1: createTextStyle({
    letterSpacing: -0.3,
    lineHeight: 36,
    size: 30,
    weight: fontWeights.semibold,
  }),
  h2: createTextStyle({
    letterSpacing: -0.2,
    lineHeight: 30,
    size: 24,
    weight: fontWeights.semibold,
  }),
  caption: createTextStyle({
    letterSpacing: 0.2,
    lineHeight: 18,
    size: 13,
  }),
  eyebrow: {
    ...createTextStyle({
      letterSpacing: 0.8,
      lineHeight: 14,
      size: 11,
      weight: fontWeights.semibold,
    }),
    textTransform: 'uppercase',
  } as TypographyStyle,
} as const;
