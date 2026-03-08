import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NumericKeypad from '../../components/NumericKeypad';
import PinDots from '../../components/PinDots';
import PrimaryButton from '../../components/PrimaryButton';
import ScreenContainer from '../../components/ScreenContainer';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { ADMIN_PIN_LENGTH } from '../../constants/app';
import { verifyAdminPin } from '../../services/repositories/settingsRepository';
import { colors, spacing, typography } from '../../theme';
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
    <ScreenContainer style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.card, isCompactWidth ? styles.cardCompact : null]}>
        <Text style={styles.title}>Admin Access</Text>
        <Text style={styles.subtitle}>Enter the 4-digit Admin PIN</Text>

        <PinDots length={pin.length} maxLength={ADMIN_PIN_LENGTH} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title={isSubmitting ? 'VERIFYING...' : 'Enter Admin'}
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
            style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
            title="Cancel"
            variant="neutral"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionsCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 640,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    width: '100%',
  },
  cardCompact: {
    paddingHorizontal: spacing.lg,
  },
  compactActionButton: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    minHeight: 24,
    textAlign: 'center',
  },
  keypadWrapper: {
    marginTop: spacing.md,
    maxWidth: 360,
    width: '100%',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
});
