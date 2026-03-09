import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';

type SurfaceTone = 'default' | 'accent' | 'info' | 'warning' | 'danger';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
}>;

const toneStyles: Record<SurfaceTone, ViewStyle> = {
  accent: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.glowPrimary,
  },
  danger: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.dangerMuted,
  },
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  info: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.infoMuted,
  },
  warning: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.warningMuted,
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
  return (
    <View style={[styles.card, toneStyles[tone], paddingStyles[padding], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
