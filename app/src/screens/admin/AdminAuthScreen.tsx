import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NumericKeypad from '../../components/NumericKeypad';
import PinDots from '../../components/PinDots';
import PrimaryButton from '../../components/PrimaryButton';
import ScreenContainer from '../../components/ScreenContainer';
import PageHeader from '../../components/ui/PageHeader';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAdminSession } from '../../context/AdminSessionContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { ADMIN_PIN_LENGTH } from '../../constants/app';
import { verifyAdminPin } from '../../services/repositories/settingsRepository';
import { colors, radius, spacing, typography, withAlpha } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type AdminAuthScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminAuth'>;

export default function AdminAuthScreen({ navigation }: AdminAuthScreenProps) {
  const { horizontalPadding, isCompactWidth, isVeryCompactWidth } =
    useResponsiveLayout();
  const { isAuthenticated, login } = useAdminSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'AdminDashboard' }],
    });
  }, [isAuthenticated, navigation]);

  const canSubmit = useMemo(
    () => pin.length === ADMIN_PIN_LENGTH && !isSubmitting,
    [isSubmitting, pin.length],
  );
  const digitsRemaining = Math.max(0, ADMIN_PIN_LENGTH - pin.length);
  const helperText = error
    ? 'Review the message below and try again.'
    : canSubmit
      ? 'PIN complete. Continue to the admin dashboard.'
      : pin.length === 0
        ? 'Use the keypad to enter the 4-digit admin PIN.'
        : `Enter ${digitsRemaining} more digit${digitsRemaining === 1 ? '' : 's'}.`;

  const appendDigit = (digit: string) => {
    setError(null);
    setPin((current) => {
      if (current.length >= ADMIN_PIN_LENGTH) {
        return current;
      }
      return `${current}${digit}`;
    });
  };

  const clearPin = () => {
    setError(null);
    setPin('');
  };

  const backspacePin = () => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  };

  const submitAdminPin = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isValid = await verifyAdminPin(pin);
      if (!isValid) {
        setError('Invalid admin PIN.');
        setPin('');
        return;
      }

      login();
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : 'Unable to validate admin PIN.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
        <PageHeader
          onBack={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }}
          subtitle="Enter the 4-digit admin PIN to manage employees, settings, logs, and payroll data."
          title="Admin Access"
        />

        <SurfaceCard padding="lg" style={styles.mainCard} tone="info">
          <View style={[styles.mainRow, isCompactWidth ? styles.mainRowCompact : null]}>
            <View style={styles.copyColumn}>
              <Text style={styles.eyebrow}>Protected access</Text>
              <Text style={styles.heroTitle}>Manager sign-in</Text>
              <Text style={styles.heroSubtitle}>
                Use this area for administrative tasks only. Employee clock actions stay on the kiosk home screen.
              </Text>

              <View style={styles.copyNote}>
                <StatusChip label="Secure Access" size="sm" tone="info" />
                <Text style={styles.copyNoteText}>
                  Admin actions affect employees, payroll reports, and kiosk settings.
                </Text>
              </View>
            </View>

            <View style={styles.entryPanel}>
              <Text style={styles.entryEyebrow}>4-digit PIN</Text>
              <PinDots length={pin.length} maxLength={ADMIN_PIN_LENGTH} />
              <Text style={styles.helperText}>{helperText}</Text>
              <Text style={[styles.errorText, !error ? styles.errorHidden : null]}>
                {error ?? ' '}
              </Text>

              <View style={styles.keypadWrapper}>
                <NumericKeypad
                  disabled={isSubmitting}
                  onBackspace={backspacePin}
                  onClear={clearPin}
                  onDigitPress={appendDigit}
                />
              </View>

              <View
                style={[
                  styles.actions,
                  isCompactWidth ? styles.actionsCompact : null,
                  isVeryCompactWidth ? styles.actionsStacked : null,
                ]}
              >
                <PrimaryButton
                  disabled={!canSubmit}
                  fullWidth={isVeryCompactWidth}
                  onPress={() => void submitAdminPin()}
                  style={
                    isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined
                  }
                  title={isSubmitting ? 'Verifying...' : 'Enter Admin'}
                  variant="primary"
                />
                <PrimaryButton
                  fullWidth={isVeryCompactWidth}
                  onPress={() => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home' }],
                    });
                  }}
                  style={
                    isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined
                  }
                  title="Cancel"
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        </SurfaceCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionsCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  compactActionButton: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 1040,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.hero,
    width: '100%',
  },
  copyColumn: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 260,
    paddingRight: spacing.lg,
  },
  copyNote: {
    backgroundColor: withAlpha(colors.backgrounds.card, 0.82),
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  copyNoteText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  entryEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  entryPanel: {
    alignItems: 'center',
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.default,
    borderRadius: radius.heroCard,
    borderWidth: 1,
    maxWidth: 460,
    minWidth: 320,
    padding: spacing.lg,
    width: '100%',
  },
  errorHidden: {
    color: 'transparent',
  },
  errorText: {
    ...typography.bodySm,
    color: colors.states.danger,
    minHeight: 20,
    textAlign: 'center',
  },
  eyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  helperText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    minHeight: 48,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    maxWidth: 440,
  },
  heroTitle: {
    ...typography.screenTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  keypadWrapper: {
    marginTop: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
  mainCard: {
    width: '100%',
  },
  mainRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.section,
  },
  mainRowCompact: {
    flexDirection: 'column',
  },
});
