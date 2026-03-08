import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { colors, spacing, typography } from '../theme';

export default function AppClock() {
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
        second: '2-digit',
      }),
    [now],
  );

  const dateText = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [now],
  );

  return (
    <View style={styles.container}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={1}
        style={[
          styles.time,
          isCompactWidth ? styles.timeCompact : null,
          isVeryCompactWidth ? styles.timeVeryCompact : null,
        ]}
      >
        {timeText}
      </Text>
      <Text style={[styles.date, isCompactWidth ? styles.dateCompact : null]}>{dateText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  date: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  dateCompact: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  time: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  timeCompact: {
    fontSize: 44,
    lineHeight: 50,
  },
  timeVeryCompact: {
    fontSize: 38,
    lineHeight: 44,
  },
});
