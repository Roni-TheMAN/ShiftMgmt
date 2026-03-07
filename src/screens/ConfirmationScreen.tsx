import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { CONFIRMATION_RESET_MS } from '../constants/app';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type ConfirmationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Confirmation'
>;

export default function ConfirmationScreen({
  navigation,
  route,
}: ConfirmationScreenProps) {
  const { horizontalPadding, isCompactWidth } = useResponsiveLayout();
  const { employeeName, eventType, timestamp } = route.params;
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(CONFIRMATION_RESET_MS / 1000),
  );

  const clockLabel = eventType === 'IN' ? 'Clock In Recorded' : 'Clock Out Recorded';
  const formattedTime = useMemo(() => new Date(timestamp).toLocaleString(), [timestamp]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }, CONFIRMATION_RESET_MS);

    const countdownInterval = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(countdownInterval);
    };
  }, [navigation]);

  return (
    <ScreenContainer style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.card, isCompactWidth ? styles.cardCompact : null]}>
        <Text style={styles.title}>{clockLabel}</Text>
        <Text style={styles.employeeName}>{employeeName}</Text>
        <Text style={styles.timestamp}>{formattedTime}</Text>
        <Text style={styles.resetText}>
          Returning to home in {secondsRemaining} second
          {secondsRemaining === 1 ? '' : 's'}.
        </Text>

        <View style={styles.buttonRow}>
          <PrimaryButton
            fullWidth={isCompactWidth}
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }}
            title="Done"
            variant="success"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 560,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    width: '100%',
  },
  cardCompact: {
    paddingHorizontal: spacing.lg,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  employeeName: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  resetText: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  timestamp: {
    ...typography.h2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.success,
    textTransform: 'uppercase',
  },
});
