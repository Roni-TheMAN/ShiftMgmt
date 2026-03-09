import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import PageHeader from '../components/ui/PageHeader';
import StatusChip from '../components/ui/StatusChip';
import SurfaceCard from '../components/ui/SurfaceCard';
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
      <View style={styles.shell}>
        <PageHeader
          badgeLabel={eventType === 'IN' ? 'IN' : 'OUT'}
          badgeTone={eventType === 'IN' ? 'success' : 'warning'}
          subtitle="Clock event saved successfully."
          title={clockLabel}
        />

        <SurfaceCard padding="lg" style={styles.card} tone="accent">
          <View style={styles.statusRow}>
            <Text style={styles.employeeName}>{employeeName}</Text>
            <StatusChip label="Completed" tone="success" />
          </View>
          <Text style={styles.timestamp}>{formattedTime}</Text>
          <Text style={styles.resetText}>
            Returning to home in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}.
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
        </SurfaceCard>
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
    maxWidth: 640,
    width: '100%',
  },
  container: {
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  employeeName: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
  },
  resetText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  shell: {
    alignItems: 'center',
    width: '100%',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  timestamp: {
    ...typography.h2,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
