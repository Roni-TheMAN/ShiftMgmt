import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
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
    backgroundColor: colors.glowPrimary,
    color: colors.primary,
  },
  danger: {
    backgroundColor: colors.dangerMuted,
    color: colors.danger,
  },
  default: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary,
  },
  info: {
    backgroundColor: colors.infoMuted,
    color: colors.info,
  },
  warning: {
    backgroundColor: colors.warningMuted,
    color: colors.warning,
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
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 156,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  marker: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  markerText: {
    ...typography.eyebrow,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  value: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
});
