import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { colors, spacing, typography } from '../theme';
import SurfaceCard from './ui/SurfaceCard';
import StatusChip from './ui/StatusChip';

type AppClockProps = {
  compact?: boolean;
  propertyName?: string;
  style?: StyleProp<ViewStyle>;
};

export default function AppClock({ compact = false, propertyName, style }: AppClockProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: compact ? undefined : '2-digit',
      }),
    [compact, now],
  );

  const dateText = useMemo(
    () =>
      now.toLocaleDateString([], {
        day: 'numeric',
        month: compact ? 'short' : 'long',
        weekday: compact ? undefined : 'long',
        year: compact ? undefined : 'numeric',
      }),
    [compact, now],
  );

  return (
    <SurfaceCard
      padding={compact ? 'sm' : 'lg'}
      style={[styles.outer, compact ? styles.outerCompact : null, style]}
      tone="default"
    >
      <View style={[styles.headerRow, compact ? styles.headerRowCompact : null]}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.eyebrow}>Shift Clock</Text>
          {propertyName ? (
            <Text numberOfLines={1} style={styles.propertyName}>
              {propertyName}
            </Text>
          ) : null}
        </View>
        <StatusChip label="Live" tone="success" size="sm" />
      </View>
      <View style={styles.container}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={[
            styles.time,
            compact ? styles.timeDense : null,
            !compact && isCompactWidth ? styles.timeCompact : null,
            !compact && isVeryCompactWidth ? styles.timeVeryCompact : null,
          ]}
        >
          {timeText}
        </Text>
        <Text style={[styles.date, compact ? styles.dateDense : null, isCompactWidth ? styles.dateCompact : null]}>
          {dateText}
        </Text>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  date: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dateDense: {
    ...typography.caption,
  },
  dateCompact: {
    textAlign: 'center',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerRowCompact: {
    marginBottom: spacing.xs,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.xs,
    marginRight: spacing.sm,
  },
  outer: {
    backgroundColor: colors.surfaceElevated,
  },
  outerCompact: {
    alignSelf: 'flex-start',
    minHeight: 0,
  },
  propertyName: {
    ...typography.label,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  time: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  timeDense: {
    fontSize: 30,
    lineHeight: 34,
  },
  timeCompact: {
    fontSize: 46,
    lineHeight: 54,
  },
  timeVeryCompact: {
    fontSize: 40,
    lineHeight: 46,
  },
});
