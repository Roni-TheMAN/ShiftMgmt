import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, componentTokens, radius, spacing, withAlpha } from '../../theme';

type SurfaceTone = 'default' | 'accent' | 'info' | 'warning' | 'danger';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

type SurfacePalette = {
  backgroundColor: string;
  borderColor: string;
  shadow: ViewStyle;
};

type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
}>;

const toneStyles: Record<SurfaceTone, SurfacePalette> = {
  accent: {
    backgroundColor: colors.backgrounds.card,
    borderColor: withAlpha(colors.accents.bronze, 0.42),
    shadow: componentTokens.card.variants.hero.shadow,
  },
  danger: {
    backgroundColor: colors.backgrounds.card,
    borderColor: withAlpha(colors.states.danger, 0.38),
    shadow: componentTokens.card.variants.danger.shadow,
  },
  default: {
    backgroundColor: componentTokens.card.variants.default.backgroundColor,
    borderColor: componentTokens.card.variants.default.borderColor,
    shadow: componentTokens.card.variants.default.shadow,
  },
  info: {
    backgroundColor: colors.backgrounds.secondary,
    borderColor: withAlpha(colors.accents.bronze, 0.18),
    shadow: componentTokens.card.variants.secondary.shadow,
  },
  warning: {
    backgroundColor: colors.backgrounds.card,
    borderColor: withAlpha(colors.accents.terracotta, 0.34),
    shadow: componentTokens.card.variants.warning.shadow,
  },
};

const paddingStyles: Record<SurfacePadding, ViewStyle | undefined> = {
  lg: {
    padding: spacing.lg,
  },
  md: {
    padding: spacing.md,
  },
  none: undefined,
  sm: {
    padding: spacing.sm,
  },
};

export default function SurfaceCard({
  children,
  style,
  tone = 'default',
  padding = 'md',
}: SurfaceCardProps) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.outer, palette.shadow, style]}>
      <View
        style={[
          styles.inner,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
          },
          paddingStyles[padding],
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderRadius: radius.heroCard,
    borderWidth: 1,
    overflow: 'hidden',
  },
  outer: {
    borderRadius: radius.heroCard,
  },
});
