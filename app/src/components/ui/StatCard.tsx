import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography, withAlpha } from '../../theme';
import SurfaceCard from './SurfaceCard';

type StatCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  marker?: string;
  tone?: 'default' | 'accent' | 'info' | 'warning' | 'danger';
};

const markerStyles = {
  accent: {
    backgroundColor: colors.tints.bronze,
    color: colors.accents.bronze,
  },
  danger: {
    backgroundColor: colors.tints.danger,
    color: colors.states.danger,
  },
  default: {
    backgroundColor: colors.backgrounds.secondary,
    color: colors.text.secondary,
  },
  info: {
    backgroundColor: withAlpha(colors.accents.bronze, 0.12),
    color: colors.accents.bronze,
  },
  warning: {
    backgroundColor: colors.tints.terracotta,
    color: colors.accents.terracotta,
  },
} as const;

export default function StatCard({
  label,
  marker,
  subtitle,
  tone = 'default',
  value,
}: StatCardProps) {
  const markerPalette = markerStyles[tone];

  return (
    <SurfaceCard padding="lg" style={styles.card} tone={tone === 'default' ? 'default' : tone}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {marker ? (
          <View style={[styles.marker, { backgroundColor: markerPalette.backgroundColor }]}>
            <Text style={[styles.markerText, { color: markerPalette.color }]}>{marker}</Text>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={1} style={styles.value}>
        {value}
      </Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 148,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.bodySm,
    color: colors.text.secondary,
  },
  marker: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
  },
  markerText: {
    ...typography.micro,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  value: {
    ...typography.screenTitle,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.lg,
  },
});
